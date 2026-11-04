import CollectionModel from '../models/collection.model';
import FileModel from '../models/file.model';
import ActivityModel from '../models/activity.model';
import { getAiProvider, isAiConfigured, parseJsonObject } from '../providers/ai';
import { UnauthorizedException } from '../utils/app-error';
import { addFilesToCollectionService, createCollectionService } from './collections.service';

/**
 * Assistant actions are intentionally limited to safe, reversible organizing
 * operations (collections). Deletion, moves, or provider mutations are never
 * proposed or applied by the assistant. Plans are previewed by the client and
 * only executed once the user explicitly confirms by POSTing the actions back.
 */
export type AssistantAction =
  | { type: 'create_collection'; name: string; description?: string | null }
  | { type: 'add_to_collection'; collection: string; fileIds: string[] };

interface AssistantPlanOutput {
  actions?: AssistantAction[];
  rationale?: string;
}

const MAX_FILES_IN_CONTEXT = 120;
const VALID_ACTION_TYPES = new Set(['create_collection', 'add_to_collection']);

/** Produces a preview plan. NEVER mutates data. */
export const planAssistantService = async (userId: string | undefined, instruction: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const provider = getAiProvider();

  if (!isAiConfigured()) {
    return {
      aiEnabled: false,
      requiresConfirmation: true,
      actions: [] as AssistantAction[],
      message: 'AI assistant is disabled. Configure AI to generate plans.',
    };
  }

  const files = await FileModel.findAllByUser(userId, undefined, {
    limit: MAX_FILES_IN_CONTEXT,
    offset: 0,
  });

  const fileContext = files.map((f) => ({
    id: f._id,
    name: f.originalName,
    type: f.mimeType,
  }));

  const chat = await provider.chat({
    json: true,
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content:
          'You are a cloud-storage organizing assistant. Given a user instruction and a JSON list of ' +
          'their files ({id,name,type}), propose ONLY safe organizing actions of these exact types:\n' +
          '  {"type":"create_collection","name":"...","description":"..."}\n' +
          '  {"type":"add_to_collection","collection":"<collection name>","fileIds":["<file id>",...]}\n' +
          'Never propose delete, rename, move, or any other action. Every fileIds entry MUST be an id from ' +
          'the provided list. Respond with strict JSON: {"actions":[...],"rationale":"..."}',
      },
      {
        role: 'user',
        content: `Instruction: ${instruction}\nFiles:\n${JSON.stringify(fileContext)}`,
      },
    ],
  });

  const parsed = (parseJsonObject<AssistantPlanOutput>(chat.text) ?? {}) as AssistantPlanOutput;
  const validIds = new Set(fileContext.map((f) => f.id));
  const knownNames = new Set((await CollectionModel.findAllForUser(userId)).map((c) => c.name.toLowerCase()));

  const actions = sanitizeActions(parsed.actions ?? [], validIds, knownNames);

  return {
    aiEnabled: true,
    requiresConfirmation: true,
    rationale: parsed.rationale ?? null,
    actions,
  };
};

/** Executes a CONFIRMED list of actions. Re-validates ownership; never trusts the client blindly. */
export const applyAssistantService = async (userId: string | undefined, actions: AssistantAction[]) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const ownedFiles = await FileModel.findAllByUser(userId, undefined, {
    limit: MAX_FILES_IN_CONTEXT,
    offset: 0,
  });
  const validIds = new Set(ownedFiles.map((f) => f._id));
  const knownNames = new Set((await CollectionModel.findAllForUser(userId)).map((c) => c.name.toLowerCase()));
  const cleaned = sanitizeActions(actions, validIds, knownNames);

  const createdByName = new Map<string, string>();
  const results: Array<
    { type: string; ok: boolean; collectionId?: string; added?: number; error?: string }
  > = [];

  for (const action of cleaned) {
    try {
      if (action.type === 'create_collection') {
        const existing = await CollectionModel.findByNameForUser(userId, action.name);
        if (existing) {
          createdByName.set(action.name.toLowerCase(), existing._id);
          results.push({ type: action.type, ok: true, collectionId: existing._id });
          continue;
        }
        const created = await createCollectionService(userId, { name: action.name, description: action.description });
        createdByName.set(action.name.toLowerCase(), (created as any)._id);
        results.push({ type: action.type, ok: true, collectionId: (created as any)._id });
      } else if (action.type === 'add_to_collection') {
        let collectionId = createdByName.get(action.collection.toLowerCase());
        if (!collectionId) {
          const found = await CollectionModel.findByNameForUser(userId, action.collection);
          collectionId = found?._id;
        }
        if (!collectionId) {
          results.push({ type: action.type, ok: false, error: 'Collection not found' });
          continue;
        }
        const updated = await addFilesToCollectionService(userId, collectionId, action.fileIds);
        results.push({
          type: action.type,
          ok: true,
          collectionId,
          added: ((updated as any).fileCount ?? action.fileIds.length),
        });
      }
    } catch (err) {
      results.push({ type: action.type, ok: false, error: (err as Error).message });
    }
  }

  await ActivityModel.record({
    userId,
    action: 'ai.assistant.apply',
    entityType: 'assistant',
    metadata: { applied: results.filter((r) => r.ok).length, total: results.length },
  }).catch(() => null);

  return { applied: results.filter((r) => r.ok).length, skipped: results.filter((r) => !r.ok).length, results };
};

const sanitizeActions = (
  actions: AssistantAction[],
  validIds: Set<string>,
  knownNames: Set<string>,
): AssistantAction[] => {
  const out: AssistantAction[] = [];
  const pendingCollections = new Set<string>();
  for (const raw of Array.isArray(actions) ? actions : []) {
    if (!raw || !VALID_ACTION_TYPES.has(raw.type)) continue;
    if (raw.type === 'create_collection') {
      const name = String(raw.name || '').trim();
      if (!name || name.length > 255) continue;
      pendingCollections.add(name.toLowerCase());
      out.push({ type: 'create_collection', name, description: raw.description ?? null });
    } else if (raw.type === 'add_to_collection') {
      const collection = String(raw.collection || '').trim();
      const ids = Array.isArray(raw.fileIds)
        ? [...new Set(raw.fileIds.filter((id) => validIds.has(id)))]
        : [];
      if (!collection || !ids.length) continue;
      if (!knownNames.has(collection.toLowerCase()) && !pendingCollections.has(collection.toLowerCase())) {
        continue; // Only target collections the user already has or that this plan creates.
      }
      out.push({ type: 'add_to_collection', collection, fileIds: ids });
    }
  }
  return out;
};

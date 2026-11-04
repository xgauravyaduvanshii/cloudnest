import { Readable } from 'stream';
import AiMetadataModel from '../models/ai-metadata.model';
import FileModel, { FileDocument } from '../models/file.model';
import ActivityModel from '../models/activity.model';
import { getAiProvider, isAiConfigured, parseJsonObject } from '../providers/ai';
import type { AiChatMessage } from '../providers/ai/ai-provider';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/app-error';

/** Safety caps so enrichment never loads an entire large object into memory. */
const MAX_BYTES_TO_READ = 4 * 1024 * 1024; // 4MB
const MAX_TEXT_CHARS = 16000; // truncation before sending to the model

interface EnrichmentModelOutput {
  summary?: string;
  description?: string;
  altText?: string;
  tags?: string[];
  categories?: string[];
  colors?: string[];
  language?: string;
}

const mediaTypeOf = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    chunks.push(buf);
    if (total >= MAX_BYTES_TO_READ) break;
  }
  stream.destroy?.();
  return Buffer.concat(chunks).subarray(0, MAX_BYTES_TO_READ);
};

const ENRICHMENT_INSTRUCTIONS =
  'You enrich cloud-stored files for search. Respond with a strict JSON object using keys: ' +
  'summary (1-2 sentences), description (a fuller sentence), altText (short accessibility text), ' +
  'tags (3-8 lowercase keywords), categories (1-3 broad lowercase categories), ' +
  'colors (up to 5 dominant color names, images only, else []), language (ISO code or null). ' +
  'Never invent facts not supported by the input.';

const buildEmbeddingInput = (file: FileDocument, meta: EnrichmentModelOutput) =>
  [
    file.originalName,
    meta.summary,
    meta.description,
    (meta.tags ?? []).join(' '),
    (meta.categories ?? []).join(' '),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXT_CHARS);

export const getAiStatusService = async () => {
  const provider = await getAiProvider();
  return {
    enabled: provider.isConfigured(),
    provider: provider.id,
    chatModel: provider.chatModel,
    visionModel: provider.visionModel,
    embeddingModel: provider.embeddingModel,
  };
};

export const enrichFileService = async (userId: string | undefined, fileId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const [file] = await FileModel.findByIdsForUser([fileId], userId);
  if (!file) throw new NotFoundException('File not found');

  if (!(await isAiConfigured())) {
    return { disabled: true, file: await AiMetadataModel.findByFileId(fileId) };
  }

  const provider = await getAiProvider();
  const mediaType = mediaTypeOf(file.mimeType);

  let extractedText: string | null = null;
  const messages: AiChatMessage[] = [{ role: 'system', content: ENRICHMENT_INSTRUCTIONS }];

  if (mediaType === 'image') {
    const { stream } = await getFileContentStream(fileId);
    const buffer = await streamToBuffer(stream as Readable);
    const dataUrl = `data:${file.mimeType};base64,${buffer.toString('base64')}`;
    messages.push({
      role: 'user',
      content: `File name: ${file.originalName}\nDescribe this image for search and accessibility.`,
      images: [dataUrl],
    });
  } else if (mediaType === 'text') {
    const { stream } = await getFileContentStream(fileId);
    const buffer = await streamToBuffer(stream as Readable);
    extractedText = buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS);
    messages.push({
      role: 'user',
      content: `File name: ${file.originalName}\nText content:\n"""\n${extractedText}\n"""`,
    });
  } else {
    // pdf / other: enrich from metadata + name only (no native text/pdf parser dependency).
    messages.push({
      role: 'user',
      content:
        `File name: ${file.originalName}\nMIME type: ${file.mimeType}\n` +
        'No inline content is available; produce best-effort metadata from the name and type only.',
    });
  }

  const chat = await provider.chat({ messages, json: true, maxTokens: 512 });
  const parsed = (parseJsonObject<EnrichmentModelOutput>(chat.text) ?? {}) as EnrichmentModelOutput;

  const embeddingInput = buildEmbeddingInput(file, parsed);
  let embedding: number[] | null = null;
  try {
    const vectors = await provider.embed([embeddingInput]);
    embedding = vectors[0] ?? null;
  } catch {
    embedding = null; // Search should degrade gracefully if embeddings are unavailable.
  }

  const metadata = await AiMetadataModel.upsert({
    fileId,
    userId,
    summary: parsed.summary ?? null,
    description: parsed.description ?? null,
    altText: parsed.altText ?? null,
    tags: normalizeList(parsed.tags),
    categories: normalizeList(parsed.categories),
    colors: normalizeList(parsed.colors),
    language: parsed.language ?? null,
    extractedText,
    embedding,
    embeddingModel: provider.embeddingModel,
    visionModel: mediaType === 'image' ? chat.model : null,
    enrichmentModel: chat.model,
  });

  await ActivityModel.record({
    userId,
    action: 'ai.file.enriched',
    entityType: 'file',
    entityId: fileId,
    metadata: { mediaType, model: chat.model },
  }).catch(() => null);

  return { disabled: false, file: metadata };
};

const normalizeList = (input?: string[] | null) =>
  Array.isArray(input)
    ? [...new Set(input.map((s) => String(s).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
    : [];

/** Internal helper to reuse the provider-agnostic read stream without a URL redirect. */
const getFileContentStream = async (fileId: string) => {
  // Imported lazily to avoid a circular import with files.service.
  const { getFileUrlService } = await import('./files.service');
  const result = await getFileUrlService(fileId);
  if (!result.stream) throw new BadRequestException('File content is not readable');
  return result;
};

export const getFileMetadataService = async (userId: string | undefined, fileId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const [file] = await FileModel.findByIdsForUser([fileId], userId);
  if (!file) throw new NotFoundException('File not found');
  return AiMetadataModel.findByFileId(fileId);
};

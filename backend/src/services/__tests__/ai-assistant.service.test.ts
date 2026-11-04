/**
 * Phase 3 assistant safety tests (no live DB).
 * Core invariant: the assistant only ever organizes into collections, proposals
 * require confirmation, and apply() re-validates ownership + collection names.
 */

jest.mock('../../config/env.config', () => ({ Env: { NODE_ENV: 'test', AI_ENABLED: 'false' } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: { findAllByUser: jest.fn(), findByIdsForUser: jest.fn() },
}));

jest.mock('../../models/collection.model', () => ({
  __esModule: true,
  default: { findAllForUser: jest.fn(), findByNameForUser: jest.fn() },
}));

jest.mock('../../models/activity.model', () => ({
  __esModule: true,
  default: { record: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../../providers/ai', () => {
  const actual = jest.requireActual('../../providers/ai/ai-provider');
  return {
    __esModule: true,
    parseJsonObject: actual.parseJsonObject,
    isAiConfigured: jest.fn(),
    getAiProvider: jest.fn(),
  };
});

jest.mock('../collections.service', () => ({
  createCollectionService: jest.fn(),
  addFilesToCollectionService: jest.fn(),
}));

import FileModel from '../../models/file.model';
import CollectionModel from '../../models/collection.model';
import { isAiConfigured, getAiProvider } from '../../providers/ai';
import { createCollectionService, addFilesToCollectionService } from '../collections.service';
import { applyAssistantService, planAssistantService } from '../ai-assistant.service';

const f = (id: string) => ({ _id: id, id, originalName: `${id}.txt`, mimeType: 'text/plain' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('planAssistantService', () => {
  it('returns no actions and never mutates when AI is disabled', async () => {
    (isAiConfigured as jest.Mock).mockReturnValue(false);
    const plan = await planAssistantService('user-1', 'group my receipts');
    expect(plan.actions).toEqual([]);
    expect(createCollectionService).not.toHaveBeenCalled();
    expect(addFilesToCollectionService).not.toHaveBeenCalled();
  });

  it('produces a preview plan without executing any mutations', async () => {
    (isAiConfigured as jest.Mock).mockReturnValue(true);
    (getAiProvider as jest.Mock).mockReturnValue({
      chat: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          actions: [
            { type: 'create_collection', name: 'Receipts' },
            { type: 'add_to_collection', collection: 'Receipts', fileIds: ['f1', 'not-a-uuid'] },
            { type: 'delete_file', fileId: 'f2' },
          ],
        }),
        model: 'm',
      }),
    });
    (FileModel.findAllByUser as jest.Mock).mockResolvedValue([f('f1')]);
    (CollectionModel.findAllForUser as jest.Mock).mockResolvedValue([]);

    const plan = await planAssistantService('user-1', 'group my receipts');

    // Unsafe action dropped; invalid file id filtered out; nothing executed at plan time.
    expect(plan.actions.map((a) => a.type)).toEqual(['create_collection', 'add_to_collection']);
    const add = plan.actions.find((a) => a.type === 'add_to_collection') as any;
    expect(add.fileIds).toEqual(['f1']);
    expect(createCollectionService).not.toHaveBeenCalled();
    expect(addFilesToCollectionService).not.toHaveBeenCalled();
  });
});

describe('applyAssistantService', () => {
  it('drops add_to_collection targeting an unknown, uncreated collection', async () => {
    (FileModel.findAllByUser as jest.Mock).mockResolvedValue([f('f1')]);
    (CollectionModel.findAllForUser as jest.Mock).mockResolvedValue([{ _id: 'c1', name: 'Taxes' }]);

    const res = await applyAssistantService('user-1', [
      { type: 'add_to_collection', collection: 'Ghost', fileIds: ['f1'] },
    ]);
    expect(res.applied).toBe(0);
    expect(addFilesToCollectionService).not.toHaveBeenCalled();
  });

  it('re-validates ownership and only passes owned ids to the collection service', async () => {
    (FileModel.findAllByUser as jest.Mock).mockResolvedValue([f('f1')]);
    (CollectionModel.findAllForUser as jest.Mock).mockResolvedValue([{ _id: 'c1', name: 'Taxes' }]);
    (CollectionModel.findByNameForUser as jest.Mock).mockResolvedValue({ _id: 'c1', name: 'Taxes' });
    (addFilesToCollectionService as jest.Mock).mockResolvedValue({ _id: 'c1', fileCount: 1 });

    const res = await applyAssistantService('user-1', [
      { type: 'add_to_collection', collection: 'Taxes', fileIds: ['f1', 'f999'] },
    ]);
    expect(res.applied).toBe(1);
    expect(addFilesToCollectionService).toHaveBeenCalledWith('user-1', 'c1', ['f1']);
  });

  it('creates a missing collection then adds owned files to it', async () => {
    (FileModel.findAllByUser as jest.Mock).mockResolvedValue([f('f1')]);
    (CollectionModel.findAllForUser as jest.Mock).mockResolvedValue([]);
    (CollectionModel.findByNameForUser as jest.Mock).mockResolvedValue(null);
    (createCollectionService as jest.Mock).mockResolvedValue({ _id: 'new1' });
    (addFilesToCollectionService as jest.Mock).mockResolvedValue({ _id: 'new1', fileCount: 1 });

    const res = await applyAssistantService('user-1', [
      { type: 'create_collection', name: 'Receipts' },
      { type: 'add_to_collection', collection: 'Receipts', fileIds: ['f1'] },
    ]);
    expect(res.applied).toBe(2);
    expect(createCollectionService).toHaveBeenCalledTimes(1);
    expect(addFilesToCollectionService).toHaveBeenCalledWith('user-1', 'new1', ['f1']);
  });
});

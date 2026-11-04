/**
 * Phase 3 smart-search tests (no live DB):
 *  - merges filename + AI-keyword + semantic candidates and de-duplicates by file id
 *  - ranks so a file matching on multiple signals wins
 *  - returns name-only matches when AI is disabled (no embeddings attempted)
 */

jest.mock('../../config/env.config', () => ({ Env: { NODE_ENV: 'test', AI_ENABLED: 'false' } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: {
    searchNamesByUser: jest.fn(),
    findByIdsForUser: jest.fn(),
  },
}));

jest.mock('../../models/ai-metadata.model', () => ({
  __esModule: true,
  default: {
    searchByKeyword: jest.fn(),
    findWithEmbeddings: jest.fn(),
    findByFileId: jest.fn(),
  },
}));

jest.mock('../../providers/ai', () => {
  const actual = jest.requireActual('../../providers/ai/ai-provider');
  return {
    __esModule: true,
    cosineSimilarity: actual.cosineSimilarity,
    isAiConfigured: jest.fn(),
    getAiProvider: jest.fn(),
  };
});

jest.mock('../files.service', () => ({
  toPublicFile: jest.fn((file: { _id: string }) => ({ _id: file._id, id: file._id })),
}));

import FileModel from '../../models/file.model';
import AiMetadataModel from '../../models/ai-metadata.model';
import { isAiConfigured, getAiProvider } from '../../providers/ai';
import { smartSearchService } from '../ai-search.service';

const fileDoc = (id: string, name: string) => ({ _id: id, id, originalName: name, mimeType: 'text/plain' });

beforeEach(() => {
  jest.clearAllMocks();
  (AiMetadataModel.findByFileId as jest.Mock).mockResolvedValue(null);
});

describe('smartSearchService', () => {
  it('returns name matches without touching embeddings when AI is disabled', async () => {
    (isAiConfigured as jest.Mock).mockReturnValue(false);
    (FileModel.searchNamesByUser as jest.Mock).mockResolvedValue([fileDoc('a', 'report.pdf')]);
    (AiMetadataModel.searchByKeyword as jest.Mock).mockResolvedValue([]);

    const res = await smartSearchService('user-1', 'report', 25);
    expect(res.aiEnabled).toBe(false);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].file._id).toBe('a');
    expect(res.results[0].match.name).toBe(true);
    expect(getAiProvider).not.toHaveBeenCalled();
  });

  it('ranks a file that matches multiple signals above a single-signal file', async () => {
    (isAiConfigured as jest.Mock).mockReturnValue(false);
    (FileModel.searchNamesByUser as jest.Mock).mockResolvedValue([fileDoc('both', 'invoice'), fileDoc('nameonly', 'invoiced')]);
    (AiMetadataModel.searchByKeyword as jest.Mock).mockResolvedValue(['both']);
    (FileModel.findByIdsForUser as jest.Mock).mockResolvedValue([fileDoc('both', 'invoice')]);

    const res = await smartSearchService('user-1', 'invoice', 25);
    expect(res.results[0].file._id).toBe('both');
    expect(res.results[0].score).toBeGreaterThan(res.results[1].score);
    expect(res.results[0].match.name).toBe(true);
    expect(res.results[0].match.keyword).toBe(true);
  });

  it('adds semantic ranking when embeddings are available', async () => {
    (isAiConfigured as jest.Mock).mockReturnValue(true);
    (FileModel.searchNamesByUser as jest.Mock).mockResolvedValue([]);
    (AiMetadataModel.searchByKeyword as jest.Mock).mockResolvedValue([]);
    (getAiProvider as jest.Mock).mockReturnValue({
      embed: jest.fn().mockResolvedValue([[1, 0, 0]]),
    });
    (AiMetadataModel.findWithEmbeddings as jest.Mock).mockResolvedValue([
      { fileId: 'sem1', embedding: [1, 0, 0] },
      { fileId: 'sem2', embedding: [0, 1, 0] },
    ]);
    (FileModel.findByIdsForUser as jest.Mock).mockResolvedValue([fileDoc('sem1', 'photo')]);

    const res = await smartSearchService('user-1', 'cat', 25);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].file._id).toBe('sem1');
    expect(res.results[0].match.semantic).toBeGreaterThan(0.9);
  });

  it('returns empty results for an empty query without hitting models', async () => {
    const res = await smartSearchService('user-1', '   ', 25);
    expect(res.results).toEqual([]);
    expect(FileModel.searchNamesByUser).not.toHaveBeenCalled();
  });
});

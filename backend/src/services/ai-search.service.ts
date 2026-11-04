import AiMetadataModel from '../models/ai-metadata.model';
import FileModel, { FileDocument } from '../models/file.model';
import { getAiProvider, isAiConfigured, cosineSimilarity } from '../providers/ai';
import { toPublicFile } from './files.service';
import { UnauthorizedException } from '../utils/app-error';

interface ScoredResult {
  file: FileDocument;
  score: number;
  match: { name: boolean; keyword: boolean; semantic: number };
  ai: {
    summary: string | null;
    tags: string[];
    categories: string[];
  } | null;
}

/**
 * Hybrid smart search:
 *  - exact/partial filename matches (always available, even before enrichment)
 *  - AI metadata keyword matches (tags/categories/summary/extracted text)
 *  - semantic vector ranking (cosine over stored embeddings) when AI is configured
 * Results are merged, de-duplicated and ranked by a combined score.
 */
export const smartSearchService = async (
  userId: string | undefined,
  query: string,
  limit = 25,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const trimmed = (query || '').trim();
  if (!trimmed) return { query: trimmed, results: [] as ScoredResult[], aiEnabled: isAiConfigured() };

  const scores = new Map<string, { doc: FileDocument; score: number; match: ScoredResult['match']; aiId?: string }>();

  const bump = (doc: FileDocument, add: number, mark: Partial<ScoredResult['match']>) => {
    const existing = scores.get(doc._id);
    if (existing) {
      existing.score += add;
      existing.match = { ...existing.match, ...mark };
    } else {
      scores.set(doc._id, { doc, score: add, match: { name: false, keyword: false, semantic: 0, ...mark } });
    }
  };

  // 1. Filename matches.
  const nameHits = await FileModel.searchNamesByUser(userId, trimmed, limit);
  for (const doc of nameHits) bump(doc, 3, { name: true });

  // 2. AI metadata keyword matches (name/summary/tags/text).
  const keywordIds = await AiMetadataModel.searchByKeyword(userId, trimmed, limit);
  if (keywordIds.length) {
    const docs = await FileModel.findByIdsForUser(keywordIds, userId);
    for (const doc of docs) bump(doc, 2, { keyword: true });
  }

  // 3. Semantic ranking.
  if (isAiConfigured()) {
    try {
      const provider = getAiProvider();
      const [queryVec] = await provider.embed([trimmed]);
      if (queryVec && queryVec.length) {
        const withEmbeddings = await AiMetadataModel.findWithEmbeddings(userId);
        const ranked = withEmbeddings
          .map((row) => ({ id: row.fileId, sim: cosineSimilarity(queryVec, row.embedding) }))
          .filter((r) => r.sim > 0.2)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, limit);
        if (ranked.length) {
          const docs = await FileModel.findByIdsForUser(ranked.map((r) => r.id), userId);
          const simById = new Map(ranked.map((r) => [r.id, r.sim]));
          for (const doc of docs) bump(doc, simById.get(doc._id) ?? 0, { semantic: simById.get(doc._id) ?? 0 });
        }
      }
    } catch {
      // Semantic search is best-effort; keyword/name results still return.
    }
  }

  // Attach AI metadata (summary/tags/categories) for display.
  const enriched: ScoredResult[] = [];
  const merged = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  for (const entry of merged) {
    const meta = await AiMetadataModel.findByFileId(entry.doc._id);
    enriched.push({
      file: entry.doc,
      score: Number(entry.score.toFixed(4)),
      match: entry.match,
      ai: meta
        ? { summary: meta.summary, tags: meta.tags, categories: meta.categories }
        : null,
    });
  }

  return {
    query: trimmed,
    aiEnabled: isAiConfigured(),
    results: enriched.map((r) => ({
      file: toPublicFile(r.file),
      score: r.score,
      match: r.match,
      ai: r.ai,
    })),
  };
};

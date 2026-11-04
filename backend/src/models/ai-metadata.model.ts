import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

interface AiMetadataRow extends QueryResultRow {
  file_id: string;
  user_id: string;
  summary: string | null;
  description: string | null;
  alt_text: string | null;
  tags: string[];
  categories: string[];
  colors: string[];
  language: string | null;
  ocr_text: string | null;
  extracted_text: string | null;
  embedding: number[] | null;
  embedding_model: string | null;
  vision_model: string | null;
  enrichment_model: string | null;
  enriched_at: Date | null;
}

export interface AiMetadataDocument {
  fileId: string;
  userId: string;
  summary: string | null;
  description: string | null;
  altText: string | null;
  tags: string[];
  categories: string[];
  colors: string[];
  language: string | null;
  ocrText: string | null;
  extractedText: string | null;
  hasEmbedding: boolean;
  enrichmentModel: string | null;
  enrichedAt: Date | null;
}

const toDocument = (row: AiMetadataRow): AiMetadataDocument => ({
  fileId: row.file_id,
  userId: row.user_id,
  summary: row.summary ?? null,
  description: row.description ?? null,
  altText: row.alt_text ?? null,
  tags: row.tags ?? [],
  categories: row.categories ?? [],
  colors: row.colors ?? [],
  language: row.language ?? null,
  ocrText: row.ocr_text ?? null,
  extractedText: row.extracted_text ?? null,
  hasEmbedding: !!row.embedding && row.embedding.length > 0,
  enrichmentModel: row.enrichment_model ?? null,
  enrichedAt: row.enriched_at,
});

const AiMetadataModel = {
  async upsert(data: {
    fileId: string;
    userId: string;
    summary?: string | null;
    description?: string | null;
    altText?: string | null;
    tags?: string[];
    categories?: string[];
    colors?: string[];
    language?: string | null;
    ocrText?: string | null;
    extractedText?: string | null;
    embedding?: number[] | null;
    embeddingModel?: string | null;
    visionModel?: string | null;
    enrichmentModel?: string | null;
  }) {
    const result = await query<AiMetadataRow>(
      `INSERT INTO file_ai_metadata (
        file_id, user_id, summary, description, alt_text, tags, categories, colors,
        language, ocr_text, extracted_text, embedding, embedding_model, vision_model,
        enrichment_model, enriched_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
      ON CONFLICT (file_id) DO UPDATE SET
        summary = COALESCE(EXCLUDED.summary, file_ai_metadata.summary),
        description = COALESCE(EXCLUDED.description, file_ai_metadata.description),
        alt_text = COALESCE(EXCLUDED.alt_text, file_ai_metadata.alt_text),
        tags = COALESCE(NULLIF(EXCLUDED.tags, '{}'), file_ai_metadata.tags),
        categories = COALESCE(NULLIF(EXCLUDED.categories, '{}'), file_ai_metadata.categories),
        colors = COALESCE(NULLIF(EXCLUDED.colors, '{}'), file_ai_metadata.colors),
        language = COALESCE(EXCLUDED.language, file_ai_metadata.language),
        ocr_text = COALESCE(EXCLUDED.ocr_text, file_ai_metadata.ocr_text),
        extracted_text = COALESCE(EXCLUDED.extracted_text, file_ai_metadata.extracted_text),
        embedding = COALESCE(EXCLUDED.embedding, file_ai_metadata.embedding),
        embedding_model = COALESCE(EXCLUDED.embedding_model, file_ai_metadata.embedding_model),
        vision_model = COALESCE(EXCLUDED.vision_model, file_ai_metadata.vision_model),
        enrichment_model = COALESCE(EXCLUDED.enrichment_model, file_ai_metadata.enrichment_model),
        enriched_at = NOW()
      RETURNING *`,
      [
        data.fileId,
        data.userId,
        data.summary ?? null,
        data.description ?? null,
        data.altText ?? null,
        data.tags ?? [],
        data.categories ?? [],
        data.colors ?? [],
        data.language ?? null,
        data.ocrText ?? null,
        data.extractedText ?? null,
        data.embedding ?? null,
        data.embeddingModel ?? null,
        data.visionModel ?? null,
        data.enrichmentModel ?? null,
      ],
    );
    return toDocument(result.rows[0]);
  },

  async findByFileId(fileId: string) {
    const result = await query<AiMetadataRow>(
      `SELECT * FROM file_ai_metadata WHERE file_id = $1`,
      [fileId],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  /** Full rows including the embedding vector for app-side semantic ranking. */
  async findWithEmbeddings(userId: string) {
    const result = await query<AiMetadataRow>(
      `SELECT * FROM file_ai_metadata WHERE user_id = $1 AND embedding IS NOT NULL`,
      [userId],
    );
    return result.rows.map((row) => ({
      ...toDocument(row),
      embedding: row.embedding ?? [],
    }));
  },

  /** Metadata keyword search over name + AI fields (tags/categories/summary). */
  async searchByKeyword(userId: string, keyword: string, limit: number) {
    const pattern = `%${keyword}%`;
    const result = await query<{ file_id: string }>(
      `SELECT m.file_id
       FROM file_ai_metadata m
       JOIN files f ON f.id = m.file_id
       WHERE m.user_id = $1
         AND (
           f.original_name ILIKE $2
           OR m.summary ILIKE $2
           OR m.description ILIKE $2
           OR m.extracted_text ILIKE $2
           OR m.ocr_text ILIKE $2
           OR EXISTS (SELECT 1 FROM unnest(m.tags) t WHERE t ILIKE $2)
           OR EXISTS (SELECT 1 FROM unnest(m.categories) c WHERE c ILIKE $2)
         )
       LIMIT $3`,
      [userId, pattern, limit],
    );
    return result.rows.map((r) => r.file_id);
  },
};

export default AiMetadataModel;

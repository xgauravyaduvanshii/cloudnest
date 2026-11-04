import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type AiModelKind = 'chat' | 'embedding' | 'vision';

interface AiModelRow extends QueryResultRow {
  id: string;
  model_id: string;
  display_name: string;
  kind: AiModelKind;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AiModelDocument {
  _id: string;
  id: string;
  modelId: string;
  displayName: string;
  kind: AiModelKind;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toDocument = (row: AiModelRow): AiModelDocument => ({
  _id: row.id,
  id: row.id,
  modelId: row.model_id,
  displayName: row.display_name,
  kind: row.kind,
  isEnabled: !!row.is_enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const AiModelModel = {
  async listAll(): Promise<AiModelDocument[]> {
    const result = await query<AiModelRow>(
      `SELECT * FROM ai_models ORDER BY kind, display_name`,
    );
    return result.rows.map(toDocument);
  },

  async listEnabled(kind?: AiModelKind): Promise<AiModelDocument[]> {
    const result = await query<AiModelRow>(
      kind
        ? `SELECT * FROM ai_models WHERE is_enabled = TRUE AND kind = $1 ORDER BY display_name`
        : `SELECT * FROM ai_models WHERE is_enabled = TRUE ORDER BY kind, display_name`,
      kind ? [kind] : [],
    );
    return result.rows.map(toDocument);
  },

  /** Returns true when the given model id is present AND enabled for the kind. */
  async isEnabledForKind(modelId: string, kind: AiModelKind): Promise<boolean> {
    const result = await query<{ one: number }>(
      `SELECT 1 AS one FROM ai_models
       WHERE model_id = $1 AND kind = $2 AND is_enabled = TRUE
       LIMIT 1`,
      [modelId, kind],
    );
    return result.rows.length > 0;
  },

  /**
   * Insert fetched models if absent (disabled by default so an admin explicitly
   * enables them). Never overwrites an existing row's enabled state.
   */
  async upsertMany(
    models: Array<{ modelId: string; displayName?: string; kind: AiModelKind }>,
  ): Promise<number> {
    let inserted = 0;
    for (const m of models) {
      const result = await query(
        `INSERT INTO ai_models (model_id, display_name, kind, is_enabled)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (model_id, kind) DO NOTHING`,
        [m.modelId, m.displayName ?? m.modelId, m.kind],
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  },

  async setEnabled(id: string, isEnabled: boolean): Promise<AiModelDocument | null> {
    const result = await query<AiModelRow>(
      `UPDATE ai_models SET is_enabled = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, isEnabled],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM ai_models WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};

export default AiModelModel;

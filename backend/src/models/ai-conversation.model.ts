import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export interface AiCitation {
  fileId: string;
  name: string;
}

interface ConversationRow extends QueryResultRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow extends QueryResultRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: AiCitation[] | null;
  reasoning: string | null;
  created_at: Date;
}

export interface AiConversationDocument {
  _id: string;
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMessageDocument {
  _id: string;
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: AiCitation[];
  reasoning: string | null;
  createdAt: Date;
}

const toConversation = (row: ConversationRow): AiConversationDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  title: row.title ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row: MessageRow): AiMessageDocument => ({
  _id: row.id,
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  citations: Array.isArray(row.citations) ? row.citations : [],
  reasoning: row.reasoning ?? null,
  createdAt: row.created_at,
});

const AiConversationModel = {
  async create(userId: string, title?: string | null) {
    const result = await query<ConversationRow>(
      `INSERT INTO ai_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title ?? null],
    );
    return toConversation(result.rows[0]);
  },

  async findByIdForUser(conversationId: string, userId: string) {
    const result = await query<ConversationRow>(
      `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  },

  async listForUser(userId: string, limit: number) {
    const result = await query<ConversationRow>(
      `SELECT * FROM ai_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(toConversation);
  },

  async touch(conversationId: string, title?: string | null) {
    await query(
      `UPDATE ai_conversations
       SET title = COALESCE($2, title), updated_at = NOW()
       WHERE id = $1`,
      [conversationId, title ?? null],
    );
  },

  async addMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: AiCitation[];
    reasoning?: string | null;
  }) {
    const result = await query<MessageRow>(
      `INSERT INTO ai_messages (conversation_id, role, content, citations, reasoning)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.conversationId,
        data.role,
        data.content,
        JSON.stringify(data.citations ?? []),
        data.reasoning ?? null,
      ],
    );
    return toMessage(result.rows[0]);
  },

  async listMessages(conversationId: string) {
    const result = await query<MessageRow>(
      `SELECT * FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return result.rows.map(toMessage);
  },

  async deleteForUser(conversationId: string, userId: string) {
    const result = await query(
      `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },
};

export default AiConversationModel;

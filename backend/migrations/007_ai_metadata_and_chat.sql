-- Phase 3: AI metadata enrichment + embeddings for smart search.
-- Forward-only and additive. AI output is stored separately from provider metadata
-- so originals are never mutated and enrichment is idempotent/re-runnable.

CREATE TABLE IF NOT EXISTS file_ai_metadata (
  file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT,
  description TEXT,
  alt_text TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  colors TEXT[] NOT NULL DEFAULT '{}',
  language VARCHAR(16),
  ocr_text TEXT,
  extracted_text TEXT,
  -- Embedding vector for semantic search (app-side cosine when pgvector is absent).
  embedding DOUBLE PRECISION[],
  embedding_model VARCHAR(128),
  vision_model VARCHAR(128),
  enrichment_model VARCHAR(128),
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_ai_metadata_user_idx ON file_ai_metadata(user_id);
CREATE INDEX IF NOT EXISTS file_ai_metadata_tags_idx ON file_ai_metadata USING GIN (tags);
CREATE INDEX IF NOT EXISTS file_ai_metadata_categories_idx ON file_ai_metadata USING GIN (categories);

DROP TRIGGER IF EXISTS set_file_ai_metadata_updated_at ON file_ai_metadata;
CREATE TRIGGER set_file_ai_metadata_updated_at
BEFORE UPDATE ON file_ai_metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Conversational AI document chat history (scoped per user; cites file sources).
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER set_ai_conversations_updated_at
BEFORE UPDATE ON ai_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON ai_messages(conversation_id, created_at);

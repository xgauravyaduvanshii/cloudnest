-- Phase 5: Admin-managed AI provider settings + model catalog + chain-of-thought.
-- Forward-only and additive. The API key is stored encrypted (AES-256-GCM) and is
-- never returned to the client. DB settings, when present, override server env.

CREATE TABLE IF NOT EXISTS ai_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  provider VARCHAR(64) NOT NULL DEFAULT 'openai',
  base_url TEXT,
  encrypted_api_key TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_chat_model VARCHAR(128),
  default_vision_model VARCHAR(128),
  default_embedding_model VARCHAR(128),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_settings_single_row CHECK (id = 1)
);

DROP TRIGGER IF EXISTS set_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER set_ai_settings_updated_at
BEFORE UPDATE ON ai_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Catalog of models offered to users. kind drives where each model appears
-- (chat dropdown, embeddings, vision). Disabled models are hidden from selection.
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  kind VARCHAR(16) NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat', 'embedding', 'vision')),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_models_unique_kind UNIQUE (model_id, kind)
);

CREATE INDEX IF NOT EXISTS ai_models_enabled_idx ON ai_models(kind) WHERE is_enabled = TRUE;

DROP TRIGGER IF EXISTS set_ai_models_updated_at ON ai_models;
CREATE TRIGGER set_ai_models_updated_at
BEFORE UPDATE ON ai_models
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Chain-of-thought: persist a brief model reasoning trace alongside assistant answers.
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS reasoning TEXT;

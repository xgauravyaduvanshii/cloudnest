-- Phase 2: file version history, collections, sharing/permissions, activity timeline.
-- Forward-only and additive. Version lineage columns already exist on files (migration 005).

-- Collections: lightweight, user-defined groups. A file can belong to many collections
-- without moving/copying the underlying provider object.
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS collections_user_name_unique_idx
  ON collections(user_id, LOWER(name));

DROP TRIGGER IF EXISTS set_collections_updated_at ON collections;
CREATE TRIGGER set_collections_updated_at
BEFORE UPDATE ON collections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, file_id)
);

CREATE INDEX IF NOT EXISTS collection_items_file_idx ON collection_items(file_id);

-- Sharing: public/private links for files, folders, or collections.
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('file', 'folder', 'collection')),
  resource_id UUID NOT NULL,
  token TEXT NOT NULL,
  visibility VARCHAR(10) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  permission VARCHAR(12) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'download', 'upload', 'edit')),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INT CHECK (max_downloads IS NULL OR max_downloads >= 0),
  download_count INT NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  view_count INT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shares_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS shares_user_id_idx ON shares(user_id);
CREATE INDEX IF NOT EXISTS shares_resource_idx ON shares(resource_type, resource_id);

DROP TRIGGER IF EXISTS set_shares_updated_at ON shares;
CREATE TRIGGER set_shares_updated_at
BEFORE UPDATE ON shares
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Audit every share action (creation, view, download, denial, revoke).
CREATE TABLE IF NOT EXISTS share_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  action VARCHAR(24) NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS share_audit_share_idx ON share_audit(share_id, created_at DESC);

-- User activity timeline.
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_type VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api')),
  action VARCHAR(48) NOT NULL,
  entity_type VARCHAR(32),
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_events_user_idx ON activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_entity_idx ON activity_events(entity_type, entity_id);

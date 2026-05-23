ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'DISABLED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(30) NOT NULL UNIQUE CHECK (provider IN ('S3', 'GOOGLE_DRIVE', 'TELEGRAM')),
  encrypted_config TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_provider_settings_updated_at ON provider_settings;
CREATE TRIGGER set_provider_settings_updated_at
BEFORE UPDATE ON provider_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS storage_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('USER', 'ADMIN')),
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('S3', 'GOOGLE_DRIVE', 'TELEGRAM')),
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'ERROR', 'PENDING_AUTH')),
  encrypted_credentials TEXT,
  external_account_id TEXT,
  external_email TEXT,
  root_folder_id TEXT,
  soft_quota_bytes BIGINT CHECK (soft_quota_bytes IS NULL OR soft_quota_bytes >= 0),
  cached_usage_bytes BIGINT NOT NULL DEFAULT 0 CHECK (cached_usage_bytes >= 0),
  cached_limit_bytes BIGINT CHECK (cached_limit_bytes IS NULL OR cached_limit_bytes >= 0),
  cached_usage_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT storage_accounts_owner_check CHECK (
    (owner_type = 'USER' AND user_id IS NOT NULL)
    OR (owner_type = 'ADMIN' AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS storage_accounts_user_id_idx ON storage_accounts(user_id);
CREATE INDEX IF NOT EXISTS storage_accounts_provider_idx ON storage_accounts(provider);
CREATE INDEX IF NOT EXISTS storage_accounts_status_idx ON storage_accounts(status);

DROP TRIGGER IF EXISTS set_storage_accounts_updated_at ON storage_accounts;
CREATE TRIGGER set_storage_accounts_updated_at
BEFORE UPDATE ON storage_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'S3',
  ADD COLUMN IF NOT EXISTS storage_account_id UUID REFERENCES storage_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_file_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'files_provider_check'
  ) THEN
    ALTER TABLE files
      ADD CONSTRAINT files_provider_check CHECK (provider IN ('S3', 'GOOGLE_DRIVE', 'TELEGRAM'));
  END IF;
END $$;

INSERT INTO provider_settings (provider, is_configured)
VALUES
  ('S3', TRUE),
  ('GOOGLE_DRIVE', FALSE),
  ('TELEGRAM', FALSE)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO storage_accounts (
  owner_type,
  provider,
  display_name,
  status,
  external_account_id,
  cached_usage_bytes,
  cached_usage_details
)
SELECT
  'ADMIN',
  'S3',
  'Default S3 Storage',
  'ACTIVE',
  'default-s3',
  COALESCE(SUM(size), 0)::bigint,
  jsonb_build_object('source', 'migration')
FROM files
WHERE NOT EXISTS (
  SELECT 1
  FROM storage_accounts
  WHERE provider = 'S3'
    AND owner_type = 'ADMIN'
    AND external_account_id = 'default-s3'
);

UPDATE files
SET
  provider = 'S3',
  storage_account_id = (
    SELECT id
    FROM storage_accounts
    WHERE provider = 'S3'
      AND owner_type = 'ADMIN'
      AND external_account_id = 'default-s3'
    LIMIT 1
  ),
  provider_file_id = COALESCE(provider_file_id, storage_key),
  provider_metadata = CASE
    WHEN provider_metadata = '{}'::jsonb THEN jsonb_build_object('storageKey', storage_key)
    ELSE provider_metadata
  END
WHERE provider = 'S3'
  AND storage_account_id IS NULL;

CREATE INDEX IF NOT EXISTS files_storage_account_id_idx ON files(storage_account_id);
CREATE INDEX IF NOT EXISTS files_provider_idx ON files(provider);
CREATE INDEX IF NOT EXISTS files_provider_file_id_idx ON files(provider_file_id);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_user_id_idx ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at DESC);

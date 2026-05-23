ALTER TABLE provider_settings
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE provider_settings
SET is_enabled = TRUE
WHERE is_enabled IS NULL;

ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'S3',
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'folders_provider_check'
  ) THEN
    ALTER TABLE folders
      ADD CONSTRAINT folders_provider_check CHECK (provider IN ('S3', 'GOOGLE_DRIVE', 'TELEGRAM'));
  END IF;
END $$;

DROP INDEX IF EXISTS folders_user_root_name_unique_idx;
DROP INDEX IF EXISTS folders_user_parent_name_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS folders_user_provider_root_name_unique_idx
  ON folders(user_id, provider, LOWER(name))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS folders_user_provider_parent_name_unique_idx
  ON folders(user_id, provider, parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS folders_provider_idx ON folders(provider);

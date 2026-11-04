-- Reliable, resumable, duplicate-safe upload jobs + Google Drive fixed-folder support.
-- Forward-only and additive: no destructive changes to existing data.

-- Upload job (one per user-initiated batch upload)
CREATE TABLE IF NOT EXISTS upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_account_id UUID REFERENCES storage_accounts(id) ON DELETE SET NULL,
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('S3', 'GOOGLE_DRIVE', 'TELEGRAM')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'PAUSED', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED')
  ),
  mode VARCHAR(24) NOT NULL DEFAULT 'FLAT' CHECK (mode IN ('FLAT', 'PRESERVE_STRUCTURE')),
  conflict_policy VARCHAR(10) NOT NULL DEFAULT 'SKIP' CHECK (conflict_policy IN ('SKIP', 'RENAME', 'VERSION')),
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  provider_folder_id TEXT,
  client_request_id TEXT,
  total_items INT NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  total_bytes BIGINT NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  processed_bytes BIGINT NOT NULL DEFAULT 0 CHECK (processed_bytes >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS upload_jobs_user_id_idx ON upload_jobs(user_id);
CREATE INDEX IF NOT EXISTS upload_jobs_status_idx ON upload_jobs(status);
CREATE INDEX IF NOT EXISTS upload_jobs_created_at_idx ON upload_jobs(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS upload_jobs_user_request_unique_idx
  ON upload_jobs(user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_upload_jobs_updated_at ON upload_jobs;
CREATE TRIGGER set_upload_jobs_updated_at
BEFORE UPDATE ON upload_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Upload job item (one per file in a batch)
CREATE TABLE IF NOT EXISTS upload_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
  item_index INT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'SKIPPED', 'FAILED')
  ),
  original_name TEXT NOT NULL,
  relative_path TEXT,
  ext TEXT,
  mime_type TEXT,
  size BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
  checksum_sha256 TEXT,
  storage_tmp_path TEXT,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  provider_file_id TEXT,
  remote_folder_id TEXT,
  attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  next_retry_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT upload_job_items_job_index_unique UNIQUE (job_id, item_index)
);

CREATE INDEX IF NOT EXISTS upload_job_items_job_status_idx ON upload_job_items(job_id, status);
CREATE INDEX IF NOT EXISTS upload_job_items_claim_idx ON upload_job_items(status, next_retry_at);
CREATE INDEX IF NOT EXISTS upload_job_items_checksum_idx ON upload_job_items(checksum_sha256);

DROP TRIGGER IF EXISTS set_upload_job_items_updated_at ON upload_job_items;
CREATE TRIGGER set_upload_job_items_updated_at
BEFORE UPDATE ON upload_job_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- File identity: checksum, original path, provider folder, and version lineage.
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS original_path TEXT,
  ADD COLUMN IF NOT EXISTS provider_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS version_group_id UUID,
  ADD COLUMN IF NOT EXISTS supersedes_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number INT NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS upload_job_item_id UUID REFERENCES upload_job_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS files_checksum_idx ON files(checksum_sha256);
CREATE INDEX IF NOT EXISTS files_version_group_idx ON files(version_group_id);
CREATE INDEX IF NOT EXISTS files_is_latest_idx ON files(is_latest);

-- Exact-duplicate guard: same user + account + target folder + name + checksum.
CREATE UNIQUE INDEX IF NOT EXISTS files_exact_duplicate_unique_idx
  ON files(user_id, storage_account_id, COALESCE(provider_folder_id, ''), LOWER(original_name), checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

-- Race-safe Google Drive folder creation cache (keyed by account + parent + normalized name).
CREATE TABLE IF NOT EXISTS drive_folder_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_account_id UUID NOT NULL REFERENCES storage_accounts(id) ON DELETE CASCADE,
  parent_folder_id TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT drive_folder_cache_unique UNIQUE (storage_account_id, parent_folder_id, name_lower)
);

CREATE INDEX IF NOT EXISTS drive_folder_cache_account_idx ON drive_folder_cache(storage_account_id);

DROP TRIGGER IF EXISTS set_drive_folder_cache_updated_at ON drive_folder_cache;
CREATE TRIGGER set_drive_folder_cache_updated_at
BEFORE UPDATE ON drive_folder_cache
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Per-account upload concurrency limit for provider-aware rate limiting.
ALTER TABLE storage_accounts
  ADD COLUMN IF NOT EXISTS max_upload_concurrency INT NOT NULL DEFAULT 3 CHECK (max_upload_concurrency >= 1);

-- Phase 4: scoped/expiring/revocable API keys, key usage logs, and webhooks.
-- Forward-only and additive. Existing keys get default scopes so behavior is
-- backward compatible (no existing integration breaks when this is applied).

-- ---- API key scoping, expiry and revocation --------------------------------
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL
  DEFAULT ARRAY['files:read', 'files:write', 'upload:write']::text[];
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS api_keys_hashed_active_idx
  ON api_keys(hashed_key) WHERE is_revoked = FALSE;

-- Per-key usage log for auditing and throttling.
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id UUID,
  method VARCHAR(8) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_key_usage_logs_key_idx
  ON api_key_usage_logs(api_key_id, created_at DESC);

-- ---- Webhooks --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret VARCHAR(128) NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_user_idx ON webhook_endpoints(user_id);

DROP TRIGGER IF EXISTS set_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER set_webhook_endpoints_updated_at
BEFORE UPDATE ON webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx
  ON webhook_deliveries(endpoint_id, created_at DESC);

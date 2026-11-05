-- Phase 6: Admin-managed notices shown to users, plus per-user dismissal state.
-- Forward-only and additive. Seeds a few polished welcome / useful notices.

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level VARCHAR(16) NOT NULL DEFAULT 'info'
    CHECK (level IN ('welcome', 'info', 'success', 'warning', 'maintenance')),
  audience VARCHAR(16) NOT NULL DEFAULT 'ALL'
    CHECK (audience IN ('ALL', 'USER', 'ADMIN')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissable BOOLEAN NOT NULL DEFAULT TRUE,
  priority SMALLINT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notices_published_idx
  ON notices (is_published, priority DESC, created_at DESC);

DROP TRIGGER IF EXISTS set_notices_updated_at ON notices;
CREATE TRIGGER set_notices_updated_at
BEFORE UPDATE ON notices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Which notices a given user has dismissed. No FK to notices is added here so a
-- deleted notice does not strand rows; we clean up dismissals in the service layer.
CREATE TABLE IF NOT EXISTS notice_dismissals (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notice_id)
);

-- Seed default notices (published) so a fresh deploy already feels polished.
INSERT INTO notices (id, title, body, level, audience, is_published, is_dismissable, priority)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'Welcome to CloudNest',
    'Thanks for joining! CloudNest gives you one simple place to upload, organize, and share files across AWS S3, Google Drive, and Telegram. Connect a storage account to get started, and reach our team any time from the Contact page.',
    'welcome', 'ALL', TRUE, TRUE, 100
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'Your files, your providers',
    'You can connect multiple storage accounts and choose exactly where each upload goes. Admins decide which providers are available, so you always see the options that are enabled for your workspace.',
    'info', 'ALL', TRUE, TRUE, 80
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'Security you can rely on',
    'Provider credentials and API keys are encrypted at rest and never exposed in your browser. You can revoke an API key instantly, and admin actions are recorded in an audit trail for accountability.',
    'success', 'ALL', TRUE, TRUE, 60
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'Meet your AI assistant',
    'The built-in AI panel can organize files, build collections, and answer questions about your storage. Use the @ button to attach folders or files as context for more precise results.',
    'info', 'ALL', TRUE, TRUE, 40
  )
ON CONFLICT (id) DO NOTHING;

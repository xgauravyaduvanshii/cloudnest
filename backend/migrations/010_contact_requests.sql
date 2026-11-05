-- Phase 6: Contact / support requests submitted from the public Contact page.
-- Forward-only and additive. Anonymous submissions are allowed; when a valid bearer
-- token accompanies the request we link it to the user so it appears in their dashboard.
-- Admins triage submissions by status (at minimum APPROVED and SOLVED).

CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW', 'APPROVED', 'IN_PROGRESS', 'SOLVED', 'REJECTED')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_requests_email_idx ON contact_requests (LOWER(email));
CREATE INDEX IF NOT EXISTS contact_requests_user_idx ON contact_requests (user_id);
CREATE INDEX IF NOT EXISTS contact_requests_status_idx ON contact_requests (status);
CREATE INDEX IF NOT EXISTS contact_requests_created_idx ON contact_requests (created_at DESC);

DROP TRIGGER IF EXISTS set_contact_requests_updated_at ON contact_requests;
CREATE TRIGGER set_contact_requests_updated_at
BEFORE UPDATE ON contact_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

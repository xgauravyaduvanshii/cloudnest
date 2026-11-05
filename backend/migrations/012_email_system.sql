-- Phase 7: SMTP transactional email system.
-- Runtime-stored SMTP configurations (multiple named, exactly one active, password
-- encrypted AES-256-GCM and never returned to the client), editable email templates,
-- and a generic email_verifications table used for signup OTP, password-reset links,
-- and admin-issued magic links (secrets stored sha256-hashed).
-- Forward-only and additive. Existing users are backfilled as verified so nobody is
-- locked out when login begins requiring email_verified.

-- 1) Email verification flag on users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET email_verified = TRUE;

-- 2) SMTP configurations (one active at a time).
CREATE TABLE IF NOT EXISTS smtp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT FALSE,
  username TEXT,
  encrypted_password TEXT,
  from_name VARCHAR(120),
  from_address TEXT NOT NULL,
  reply_to TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce at most one active configuration.
CREATE UNIQUE INDEX IF NOT EXISTS smtp_single_active
  ON smtp_configurations ((TRUE)) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS smtp_configurations_active_idx
  ON smtp_configurations (is_active);

DROP TRIGGER IF EXISTS set_smtp_configurations_updated_at ON smtp_configurations;
CREATE TRIGGER set_smtp_configurations_updated_at
BEFORE UPDATE ON smtp_configurations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3) Editable email templates.
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  description TEXT,
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_email_templates_updated_at ON email_templates;
CREATE TRIGGER set_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4) OTP / reset / magic-link verifications (secrets hashed).
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose VARCHAR(24) NOT NULL
    CHECK (purpose IN ('signup_otp', 'magic_link', 'password_reset')),
  code_hash TEXT,
  token_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx
  ON email_verifications (user_id, purpose);

-- 5) Seed default transactional templates.
-- Shared, brand-neutral layout (no red accent). Variables use {{token}} syntax.
INSERT INTO email_templates (id, key, name, subject, html_body, text_body, description, variables, is_enabled)
VALUES
  (
    'e0000000-0000-4000-8000-000000000001',
    'signup_otp',
    'Signup verification code',
    'Your CloudNest verification code',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Verify your email</h2><p style="margin:0 0 18px;color:#475569">Hi {{userName}}, enter this code to activate your CloudNest account. It expires in {{expiresMinutes}} minutes.</p><div style="font-size:30px;font-weight:700;letter-spacing:6px;background:#f1f5f9;border-radius:10px;padding:16px;text-align:center;color:#0f172a">{{otpCode}}</div><p style="margin:20px 0 0;font-size:13px;color:#94a3b8">If you didn''t request this, you can ignore this email.</p></div>',
    'Hi {{userName}}, your CloudNest verification code is {{otpCode}}. It expires in {{expiresMinutes}} minutes. If you didn''t request this, ignore this email.',
    'Six-digit code sent when a user signs up with email + password.',
    ARRAY['userName','otpCode','expiresMinutes'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'welcome',
    'Welcome email',
    'Welcome to CloudNest',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Welcome, {{userName}}!</h2><p style="margin:0 0 16px;color:#475569">Your CloudNest account is verified and ready. Upload, organize, and share files across AWS S3, Google Drive, and Telegram from one place.</p><a href="{{appUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Open CloudNest</a></div>',
    'Welcome, {{userName}}! Your CloudNest account is ready. Open it here: {{appUrl}}',
    'Sent once after a new account is successfully verified.',
    ARRAY['userName','appUrl'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'signup_success',
    'Account created confirmation',
    'Your CloudNest account is set up',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Account created</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, your email {{email}} is confirmed and your CloudNest account is now active.</p><p style="margin:0;font-size:13px;color:#94a3b8">You can connect a storage account any time from your dashboard.</p></div>',
    'Hi {{userName}}, your account for {{email}} is confirmed and active.',
    'Confirmation that registration completed successfully.',
    ARRAY['userName','email'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000004',
    'login_new_device',
    'New login notification',
    'A new sign-in to your CloudNest account',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">New sign-in detected</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, your account was signed in on {{dateTime}}. If this was you, no action is needed.</p><p style="margin:0;font-size:13px;color:#94a3b8">If you don''t recognize this activity, reset your password right away.</p></div>',
    'Hi {{userName}}, your CloudNest account was signed in on {{dateTime}}. If this wasn''t you, reset your password.',
    'Security notification sent after a successful login.',
    ARRAY['userName','dateTime'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000005',
    'password_reset',
    'Password reset link',
    'Reset your CloudNest password',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Reset your password</h2><p style="margin:0 0 18px;color:#475569">Hi {{userName}}, we received a request to reset your password. This link expires in {{expiresMinutes}} minutes.</p><a href="{{resetLink}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Choose a new password</a><p style="margin:20px 0 0;font-size:13px;color:#94a3b8">If you didn''t request this, you can safely ignore this email.</p></div>',
    'Hi {{userName}}, reset your CloudNest password using this link (expires in {{expiresMinutes}} minutes): {{resetLink}}',
    'Password reset request with a single-use link.',
    ARRAY['userName','resetLink','expiresMinutes'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000006',
    'magic_link',
    'Magic sign-in link',
    'Your CloudNest sign-in link',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Sign in to CloudNest</h2><p style="margin:0 0 18px;color:#475569">Hi {{userName}}, use the button below to sign in. This link expires in {{expiresMinutes}} minutes and can only be used once.</p><a href="{{magicLink}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Sign in securely</a><p style="margin:20px 0 0;font-size:13px;color:#94a3b8">Didn''t expect this? You can ignore this email.</p></div>',
    'Hi {{userName}}, sign in to CloudNest with this link (expires in {{expiresMinutes}} minutes): {{magicLink}}',
    'Admin-issued or passwordless magic sign-in link.',
    ARRAY['userName','magicLink','expiresMinutes'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000007',
    'provider_connected',
    'Storage account connected',
    'Your {{providerName}} account is connected',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">{{providerName}} connected</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, your {{providerName}} storage account is now connected to CloudNest. You can start routing uploads to it from your dashboard.</p></div>',
    'Hi {{userName}}, your {{providerName}} account was connected to CloudNest.',
    'Confirmation that a storage provider was linked.',
    ARRAY['userName','providerName'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000008',
    'provider_reconnect_required',
    'Provider reconnect required',
    'Action needed: reconnect {{providerName}}',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Reconnect {{providerName}}</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, access to your {{providerName}} account was revoked or has expired. Uploads and syncs to that account will fail until you reconnect it.</p><a href="{{accountUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Reconnect account</a></div>',
    'Hi {{userName}}, your {{providerName}} access needs to be reconnected: {{accountUrl}}',
    'Auth/consent revoked for a connected provider.',
    ARRAY['userName','providerName','accountUrl'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000009',
    'dashboard_error',
    'Dashboard error notification',
    'Something failed on your CloudNest dashboard',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">We hit an error</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, an operation on your dashboard didn''t complete.</p><div style="background:#f1f5f9;border-radius:8px;padding:14px;font-size:13px;color:#334155;white-space:pre-wrap">{{errorDetails}}</div><p style="margin:16px 0 0;font-size:13px;color:#94a3b8">You can retry from your dashboard, or contact support if it keeps happening.</p></div>',
    'Hi {{userName}}, a CloudNest operation failed: {{errorDetails}}',
    'Notifies a user when a dashboard operation fails terminally.',
    ARRAY['userName','errorDetails'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000010',
    'promotion',
    'Promotion / marketing announcement',
    '{{headline}}',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">{{headline}}</h2><div style="color:#475569;line-height:1.6">{{promoContent}}</div>{{ctaButton}}</div>',
    '{{headline}} — {{promoContent}}',
    'Admin-authored marketing or announcement broadcast.',
    ARRAY['userName','headline','promoContent','ctaButton'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000011',
    'contact_status_update',
    'Contact request status change',
    'Update on your CloudNest request',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">Your request is {{status}}</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}}, the status of your request "{{subject}}" is now <strong>{{status}}</strong>.</p><p style="margin:0;font-size:13px;color:#94a3b8">{{message}}</p></div>',
    'Hi {{userName}}, your request "{{subject}}" is now {{status}}. {{message}}',
    'Sent when an admin changes a contact request status.',
    ARRAY['userName','subject','status','message'], TRUE
  ),
  (
    'e0000000-0000-4000-8000-000000000012',
    'notice_broadcast',
    'Announcement broadcast',
    '{{title}}',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f2937"><h2 style="margin:0 0 12px;color:#0f172a">{{title}}</h2><p style="margin:0 0 16px;color:#475569">Hi {{userName}},</p><div style="color:#475569;line-height:1.6;white-space:pre-wrap">{{body}}</div></div>',
    '{{title}} — Hi {{userName}}, {{body}}',
    'Broadcasts an admin notice body to an audience.',
    ARRAY['userName','title','body'], TRUE
  )
ON CONFLICT (id) DO NOTHING;

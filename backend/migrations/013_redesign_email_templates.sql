-- Phase 7.1: brand redesign of every transactional email template.
--
-- Replaces the plain seeded bodies from 012 with the CloudNest layout: dark hero
-- header with the wordmark, red brand rule, white content card, status eyebrow,
-- code boxes, primary buttons, and a shared footnote plus footer. Typography uses
-- the app font stack (Onest/Outfit) and the colors come from the theme in
-- client/src/index.css: brand red #e42a35 / #ff5c63, dark hero #160406, neutral
-- grays for text and hairline borders.
--
-- Every footer reads "CloudNest by FlyingDarkDev / Urmate" with clickable links to
-- https://flyingdarkdev.com and https://urmate.tech, and ends with a copyright line
-- built from the {{currentYear}} placeholder. currentYear is a system variable the
-- renderer injects at send time (src/utils/render-template.ts -> withSystemVars),
-- so the year rolls forward automatically and admins never edit templates for it.
-- Plain-text bodies carry the same footer with the URLs written out in full.
--
-- The shell is stored once in pg_temp helper functions (dropped with the session)
-- so all 12 rows stay byte-identical outside their content. Rendered rows remain
-- complete, admin-editable documents. Rows are matched by key, so customized
-- defaults are intentionally replaced by this redesign. No schema change.

-- HTML document: preheader, hero, content card, footnote, footer.
CREATE OR REPLACE FUNCTION pg_temp.cn_email_doc(p_preheader TEXT, p_body TEXT, p_footnote TEXT)
RETURNS TEXT AS $$
  SELECT
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta http-equiv="X-UA-Compatible" content="IE=edge" /><meta name="x-apple-disable-message-reformatting" /><meta name="color-scheme" content="light only" /><title>CloudNest</title><style type="text/css">@media only screen and (max-width:620px){.cn-cell{padding-left:18px !important;padding-right:18px !important;}.cn-card{padding:22px 20px 20px 20px !important;}.cn-title{font-size:19px !important;}.cn-note{padding:12px 20px 14px 20px !important;}.cn-hero-tag{display:none !important;}}</style></head><body style="margin:0;padding:0;background-color:#f4f2f5;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f2f5;">' || p_preheader ||
    '</div><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f4f2f5" style="background-color:#f4f2f5;"><tr><td align="center" style="padding:26px 12px 30px 12px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;"><tr><td bgcolor="#160406" class="cn-cell" style="background-color:#160406;border-radius:16px 16px 0 0;padding:22px 30px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">cloud<span style="color:#ff5c63;">nest</span></td><td align="right" class="cn-hero-tag" style="font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#ff9aa0;">Multi-provider storage</td></tr></table></td></tr><tr><td bgcolor="#e42a35" style="height:3px;line-height:3px;font-size:1px;background-color:#e42a35;">&nbsp;</td></tr><tr><td bgcolor="#ffffff" class="cn-card" style="background-color:#ffffff;border-left:1px solid #ebe4ee;border-right:1px solid #ebe4ee;padding:28px 30px 26px 30px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#5b5263;">' || p_body ||
    '</td></tr><tr><td bgcolor="#faf8fb" class="cn-note" style="background-color:#faf8fb;border-left:1px solid #ebe4ee;border-right:1px solid #ebe4ee;border-bottom:1px solid #ebe4ee;border-radius:0 0 16px 16px;padding:14px 30px 16px 30px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8d8496;">' || p_footnote ||
    '</td></tr><tr><td align="center" style="padding:22px 14px 0 14px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.75;color:#8d8496;"><p style="margin:0 0 6px 0;">CloudNest by <a href="https://flyingdarkdev.com" target="_blank" rel="noopener" style="color:#5b5263;font-weight:600;text-decoration:underline;">FlyingDarkDev</a> / <a href="https://urmate.tech" target="_blank" rel="noopener" style="color:#5b5263;font-weight:600;text-decoration:underline;">Urmate</a></p><p style="margin:0 0 10px 0;">You are receiving this email because you have a CloudNest account.</p><p style="margin:0;color:#a79fb0;">&copy; {{currentYear}} CloudNest. All rights reserved.</p></td></tr></table></td></tr></table></body></html>';
$$ LANGUAGE sql;

-- Plain-text document: brand heading, body, shared footer.
CREATE OR REPLACE FUNCTION pg_temp.cn_email_text(p_heading TEXT, p_body TEXT)
RETURNS TEXT AS $$
  SELECT 'CLOUDNEST  |  ' || p_heading || E'\n\n' || p_body || '
--

CloudNest by FlyingDarkDev (https://flyingdarkdev.com) / Urmate (https://urmate.tech)
You are receiving this email because you have a CloudNest account.
© {{currentYear}} CloudNest. All rights reserved.
';
$$ LANGUAGE sql;

-- signup_otp: account security
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Enter this 6-digit code to finish activating your CloudNest account.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Account security</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Verify your email</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">Enter the code below to activate your CloudNest account. It is valid for <strong style="color:#1a1420;">{{expiresMinutes}} minutes</strong>.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:10px 0 20px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#fdf3f3" style="background-color:#fdf3f3;border:1px solid #f3d0d0;border-radius:12px;padding:16px 19px 16px 26px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:7px;color:#b3261e;">{{otpCode}}</td></tr></table></td></tr></table><p style="margin:14px 0 0 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8d8496;">For your security, never share this code with anyone. CloudNest staff will never ask for it.</p>',
    'Did not request a CloudNest account? You can safely ignore this email and no account will be created.'
  ),
  text_body = pg_temp.cn_email_text('Verify your email', 'Hi {{userName}},

Enter the code below to activate your CloudNest account. It is valid for {{expiresMinutes}} minutes.

Verification code: {{otpCode}}

For your security, never share this code with anyone. CloudNest staff will never ask for it.'),
  variables = ARRAY['userName', 'otpCode', 'expiresMinutes', 'currentYear'],
  updated_at = NOW()
WHERE key = 'signup_otp';

-- welcome: welcome aboard
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Your CloudNest account is verified and ready to use.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Welcome aboard</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Welcome, {{userName}}!</h1><p style="margin:0 0 14px 0;">Your CloudNest account is verified and ready. From one dashboard you can:</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="16" style="padding:0 8px 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#e42a35;">&#9679;</td><td style="padding:0 0 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#5b5263;"><strong style="color:#1a1420;">One control plane.</strong> Route uploads to AWS S3, Google Drive, or Telegram without rewriting your app.</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="16" style="padding:0 8px 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#e42a35;">&#9679;</td><td style="padding:0 0 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#5b5263;"><strong style="color:#1a1420;">Share on your terms.</strong> Publish files, folders, and collections with scoped, revocable links.</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="16" style="padding:0 8px 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#e42a35;">&#9679;</td><td style="padding:0 0 12px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#5b5263;"><strong style="color:#1a1420;">Stay in control.</strong> Track activity, file versions, previews, and storage usage in one overview.</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:6px 0 4px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#e42a35" style="background-color:#e42a35;border-radius:10px;"><a href="{{appUrl}}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Open CloudNest</a></td></tr></table></td></tr></table>',
    'Connect a storage account any time from Storage accounts, and use API keys for programmatic uploads.'
  ),
  text_body = pg_temp.cn_email_text('Welcome, {{userName}}!', 'Your CloudNest account is verified and ready. From one dashboard you can:

- One control plane: route uploads to AWS S3, Google Drive, or Telegram.
- Share on your terms: publish files, folders, and collections with scoped links.
- Stay in control: track activity, file versions, previews, and storage usage.

Open CloudNest: {{appUrl}}'),
  variables = ARRAY['userName', 'appUrl', 'currentYear'],
  updated_at = NOW()
WHERE key = 'welcome';

-- signup_success: confirmed
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Your email address is confirmed and your CloudNest account is active.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Confirmed</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Your account is all set</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">The email address <strong style="color:#1a1420;">{{email}}</strong> is confirmed and your CloudNest account is now active.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Account</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">Active</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Email</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{email}}</td></tr></table></td></tr></table><p style="margin:0 0 14px 0;">Connect a storage account when you are ready, and CloudNest routes new uploads to it automatically.</p>',
    'Did not create this account? Contact CloudNest support so we can secure the address.'
  ),
  text_body = pg_temp.cn_email_text('Your account is all set', 'Hi {{userName}},

The email address {{email}} is confirmed and your CloudNest account is now active.

Account: Active
Email: {{email}}

Connect a storage account when you are ready, and CloudNest routes new uploads to it automatically.'),
  variables = ARRAY['userName', 'email', 'currentYear'],
  updated_at = NOW()
WHERE key = 'signup_success';

-- login_new_device: security notice
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Your CloudNest account was used to sign in. Check that this was you.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Security notice</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">New sign-in detected</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">Your CloudNest account was used to sign in at the following time.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Time</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{dateTime}}</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Service</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">CloudNest dashboard</td></tr></table></td></tr></table><p style="margin:0 0 14px 0;">If this was you, no action is needed.</p>',
    'If you do not recognize this sign-in, change your password immediately from your security settings.'
  ),
  text_body = pg_temp.cn_email_text('New sign-in detected', 'Hi {{userName}},

Your CloudNest account was used to sign in at the following time.

Time: {{dateTime}}
Service: CloudNest dashboard

If this was you, no action is needed.'),
  variables = ARRAY['userName', 'dateTime', 'currentYear'],
  updated_at = NOW()
WHERE key = 'login_new_device';

-- password_reset: password reset
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Use this secure link to choose a new CloudNest password.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Password reset</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Reset your password</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">A password reset was requested for your account. This link is valid for <strong style="color:#1a1420;">{{expiresMinutes}} minutes</strong> and can be used only once.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:6px 0 4px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#e42a35" style="background-color:#e42a35;border-radius:10px;"><a href="{{resetLink}}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Choose a new password</a></td></tr></table></td></tr></table><p style="margin:16px 0 0 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8d8496;word-break:break-word;">If the button above does not work, copy and paste this link into your browser:<br /><a href="{{resetLink}}" style="color:#c0341d;text-decoration:underline;">{{resetLink}}</a></p>',
    'Did not request a password reset? You can safely ignore this email; your current password stays unchanged.'
  ),
  text_body = pg_temp.cn_email_text('Reset your password', 'Hi {{userName}},

A password reset was requested for your account. This link is valid for {{expiresMinutes}} minutes and can be used only once.

Choose a new password: {{resetLink}}'),
  variables = ARRAY['userName', 'resetLink', 'expiresMinutes', 'currentYear'],
  updated_at = NOW()
WHERE key = 'password_reset';

-- magic_link: passwordless sign-in
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Use this one-time link to sign in to CloudNest.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Passwordless sign-in</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Sign in to CloudNest</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">Use the button below to sign in. For your security, this link expires in <strong style="color:#1a1420;">{{expiresMinutes}} minutes</strong> and works only once.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:6px 0 4px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#e42a35" style="background-color:#e42a35;border-radius:10px;"><a href="{{magicLink}}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Sign in securely</a></td></tr></table></td></tr></table><p style="margin:16px 0 0 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8d8496;word-break:break-word;">If the button above does not work, copy and paste this link into your browser:<br /><a href="{{magicLink}}" style="color:#c0341d;text-decoration:underline;">{{magicLink}}</a></p>',
    'Did not request this link? You can safely ignore this email; nobody else can use it to reach your account.'
  ),
  text_body = pg_temp.cn_email_text('Sign in to CloudNest', 'Hi {{userName}},

Use the link below to sign in to CloudNest. For your security, it expires in {{expiresMinutes}} minutes and works only once.

Sign in: {{magicLink}}'),
  variables = ARRAY['userName', 'magicLink', 'expiresMinutes', 'currentYear'],
  updated_at = NOW()
WHERE key = 'magic_link';

-- provider_connected: connected
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Your {{providerName}} storage account is now linked to CloudNest.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Connected</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">{{providerName}} is now linked</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">Your <strong style="color:#1a1420;">{{providerName}}</strong> storage account is connected to CloudNest. New uploads can be routed to it right away.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Provider</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{providerName}}</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Status</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">Connected</td></tr></table></td></tr></table>',
    'You can switch or disconnect providers at any time from Storage accounts in your dashboard.'
  ),
  text_body = pg_temp.cn_email_text('{{providerName}} is now linked', 'Hi {{userName}},

Your {{providerName}} storage account is connected to CloudNest. New uploads can be routed to it right away.

Provider: {{providerName}}
Status: Connected'),
  variables = ARRAY['userName', 'providerName', 'currentYear'],
  updated_at = NOW()
WHERE key = 'provider_connected';

-- provider_reconnect_required: action needed
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'CloudNest lost access to your {{providerName}} account.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Action needed</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Reconnect {{providerName}}</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">Access to your <strong style="color:#1a1420;">{{providerName}}</strong> account was revoked or has expired. Uploads and syncs to that account will fail until you reconnect it.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Provider</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{providerName}}</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Status</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">Action required</td></tr></table></td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:6px 0 4px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#e42a35" style="background-color:#e42a35;border-radius:10px;"><a href="{{accountUrl}}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Reconnect account</a></td></tr></table></td></tr></table>',
    'If you removed this access on purpose, you can safely ignore this email.'
  ),
  text_body = pg_temp.cn_email_text('Reconnect {{providerName}}', 'Hi {{userName}},

Access to your {{providerName}} account was revoked or has expired. Uploads and syncs to that account will fail until you reconnect it.

Provider: {{providerName}}
Status: Action required

Reconnect your account: {{accountUrl}}'),
  variables = ARRAY['userName', 'providerName', 'accountUrl', 'currentYear'],
  updated_at = NOW()
WHERE key = 'provider_reconnect_required';

-- dashboard_error: operation failed
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'A CloudNest operation could not be completed. Here are the details.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Operation failed</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">We hit an error</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">An operation in your CloudNest dashboard could not be completed.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#1a1420;white-space:pre-wrap;word-break:break-word;">{{errorDetails}}</td></tr></table><p style="margin:0 0 14px 0;">You can retry from the dashboard. If it keeps failing, contact support with the details above.</p>',
    'No action is needed if this error was expected or you already resolved it.'
  ),
  text_body = pg_temp.cn_email_text('We hit an error', 'Hi {{userName}},

An operation in your CloudNest dashboard could not be completed.

Details: {{errorDetails}}

You can retry from the dashboard. If it keeps failing, contact support with these details.'),
  variables = ARRAY['userName', 'errorDetails', 'currentYear'],
  updated_at = NOW()
WHERE key = 'dashboard_error';

-- promotion: news from cloudnest
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'An announcement from the CloudNest team.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">News from CloudNest</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">{{headline}}</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:16px 18px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d3243;white-space:pre-wrap;word-break:break-word;">{{promoContent}}</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:2px 0 6px 0;">{{ctaButton}}</td></tr></table>',
    'Announcements are written by the CloudNest team. Admins can disable this template any time.'
  ),
  text_body = pg_temp.cn_email_text('{{headline}}', 'Hi {{userName}},

{{promoContent}}'),
  variables = ARRAY['userName', 'headline', 'promoContent', 'ctaButton', 'currentYear'],
  updated_at = NOW()
WHERE key = 'promotion';

-- contact_status_update: request update
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'Your CloudNest request is now {{status}}.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Request update</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">Your request is {{status}}</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><p style="margin:0 0 14px 0;">The status of your CloudNest request changed to <strong style="color:#1a1420;">{{status}}</strong>.</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Subject</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{subject}}</td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8d8496;">Status</td><td align="right" style="padding:5px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1420;">{{status}}</td></tr></table></td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:16px 18px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d3243;white-space:pre-wrap;word-break:break-word;">{{message}}</td></tr></table>',
    'You can add more details or send a new request from the CloudNest support page.'
  ),
  text_body = pg_temp.cn_email_text('Your request is {{status}}', 'Hi {{userName}},

The status of your CloudNest request changed to {{status}}.

Subject: {{subject}}
Status: {{status}}

Message from the team: {{message}}'),
  variables = ARRAY['userName', 'subject', 'status', 'message', 'currentYear'],
  updated_at = NOW()
WHERE key = 'contact_status_update';

-- notice_broadcast: notice
UPDATE email_templates SET
  html_body = pg_temp.cn_email_doc(
    'An announcement from the CloudNest team.',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 11px;border-radius:999px;background-color:#fdf1f1;border:1px solid #f5d3d3;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c0341d;">Notice</td></tr></table><h1 class="cn-title" style="margin:14px 0 10px 0;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#1a1420;">{{title}}</h1><p style="margin:0 0 10px 0;">Hi {{userName}},</p><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf8fb;border:1px solid #ebe4ee;border-radius:12px;margin:0 0 16px 0;"><tr><td style="padding:16px 18px;font-family:Onest,Outfit,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d3243;white-space:pre-wrap;word-break:break-word;">{{body}}</td></tr></table>',
    'This announcement was published by the CloudNest team for the accounts it affects.'
  ),
  text_body = pg_temp.cn_email_text('{{title}}', 'Hi {{userName}},

{{body}}'),
  variables = ARRAY['userName', 'title', 'body', 'currentYear'],
  updated_at = NOW()
WHERE key = 'notice_broadcast';

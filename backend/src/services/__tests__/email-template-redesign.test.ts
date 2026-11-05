/**
 * Guards the shipped email template redesign. Bodies live in the database, so the
 * migration is the source of truth for the shared layout: this checks that the
 * branded shell and the footer (brand links + {{currentYear}} copyright) are
 * written once and applied to every transactional template, and that no legacy
 * body survives.
 */
import fs from 'fs';
import path from 'path';

const MIGRATION = path.join(
  __dirname,
  '../../../migrations/013_redesign_email_templates.sql',
);
const sql = fs.readFileSync(MIGRATION, 'utf8');

// The migration explains itself in leading comments; assertions about how often
// something is written should only look at the statements.
const statements = sql
  .split('\n')
  .filter((line) => !line.startsWith('--'))
  .join('\n');

const TEMPLATE_KEYS = [
  'signup_otp',
  'welcome',
  'signup_success',
  'login_new_device',
  'password_reset',
  'magic_link',
  'provider_connected',
  'provider_reconnect_required',
  'dashboard_error',
  'promotion',
  'contact_status_update',
  'notice_broadcast',
];

describe('013 email template redesign', () => {
  it('draws the footer once in the shared shell', () => {
    expect(statements).toContain(
      'CloudNest by <a href="https://flyingdarkdev.com"',
    );
    expect(statements).toContain(
      'FlyingDarkDev</a> / <a href="https://urmate.tech"',
    );
    expect(statements).toContain('Urmate</a>');
    // Each footer link must appear exactly twice - once in the HTML shell, once in
    // the plain-text footer. Repeating it per template is how layouts drift.
    expect(statements.match(/flyingdarkdev\.com/g)?.length).toBe(2);
    expect(statements.match(/urmate\.tech/g)?.length).toBe(2);
  });

  it('uses the dynamic year placeholder in both formats', () => {
    expect(statements).toContain(
      '&copy; {{currentYear}} CloudNest. All rights reserved.',
    );
    expect(statements).toContain(
      '© {{currentYear}} CloudNest. All rights reserved.',
    );
    expect(statements).not.toMatch(/© 20\d\d/); // never a hard-coded year
  });

  it('updates every transactional template by key', () => {
    for (const key of TEMPLATE_KEYS) {
      expect(sql).toContain(`WHERE key = '${key}';`);
    }
    expect(sql.match(/UPDATE email_templates SET/g)?.length).toBe(
      TEMPLATE_KEYS.length,
    );
  });

  it('renders every body through the shared document helpers', () => {
    // Count call sites only, not the CREATE OR REPLACE FUNCTION declarations.
    expect(sql.match(/= pg_temp\.cn_email_doc\(/g)?.length).toBe(
      TEMPLATE_KEYS.length,
    );
    expect(sql.match(/= pg_temp\.cn_email_text\(/g)?.length).toBe(
      TEMPLATE_KEYS.length,
    );
  });

  it('drops the pre-redesign layout', () => {
    expect(sql).not.toContain('font-family:Inter,Arial,sans-serif');
    expect(sql).not.toContain('#4f46e5'); // off-brand indigo buttons
  });

  it('keeps the CloudNest brand palette and app font stack', () => {
    expect(sql).toContain('Onest,Outfit,');
    expect(sql).toContain('#e42a35'); // brand red rule and primary buttons
    expect(sql).toContain('#160406'); // dark hero header
  });

  it('lists currentYear as an available variable on every template', () => {
    const arrays = sql.match(/variables = ARRAY\[[^\]]*\]/g) ?? [];
    expect(arrays.length).toBe(TEMPLATE_KEYS.length);
    for (const list of arrays) expect(list).toContain("'currentYear'");
  });
});

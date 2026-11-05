/**
 * Unit tests for the token/code helpers backing email verification. Codes are
 * numeric OTPs; tokens are opaque hex digests; both are stored sha256-hashed
 * and compared in constant time.
 */
import { randomCode, randomToken, secureEquals, sha256 } from '../token';

describe('randomCode', () => {
  it('returns a 6-digit numeric string by default', () => {
    const code = randomCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('honours a custom length', () => {
    expect(randomCode(4)).toMatch(/^\d{4}$/);
    expect(randomCode(8)).toHaveLength(8);
  });

  it('produces varying codes across calls', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomCode()));
    // Statistically there will be collisions, but not a single fixed value.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('randomToken', () => {
  it('returns 64 hex characters (32 bytes)', () => {
    const token = randomToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('is unique between calls', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe('sha256', () => {
  it('is deterministic and 64 hex chars', () => {
    const a = sha256('cloudnest');
    expect(a).toBe(sha256('cloudnest'));
    expect(/^[0-9a-f]{64}$/.test(a)).toBe(true);
  });

  it('changes with input', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('secureEquals', () => {
  it('matches equal digests', () => {
    const h = sha256('secret');
    expect(secureEquals(h, h)).toBe(true);
  });

  it('rejects different digests of the same length', () => {
    expect(secureEquals(sha256('a'), sha256('b'))).toBe(false);
  });

  it('short-circuits on length mismatch or empty input', () => {
    expect(secureEquals('short', 'muchlonger')).toBe(false);
    expect(secureEquals('', '')).toBe(false);
    expect(secureEquals('x', '')).toBe(false);
  });
});

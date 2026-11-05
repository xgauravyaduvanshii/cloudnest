import crypto from 'crypto';

/** Numeric one-time code of the requested length (default 6 digits, zero-padded). */
export const randomCode = (length = 6): string => {
  let out = '';
  while (out.length < length) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out.slice(0, length);
};

/** URL-safe opaque token (32 random bytes, hex encoded) for magic links / resets. */
export const randomToken = (): string => crypto.randomBytes(32).toString('hex');

/** sha256 hex digest. OTPs and link tokens are stored hashed, never in plaintext. */
export const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

/** Constant-time comparison of two digests to avoid timing leaks. */
export const secureEquals = (a: string, b: string): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
};

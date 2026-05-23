import crypto from 'crypto';
import { Env } from '../config/env.config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getKey = () => crypto.createHash('sha256').update(Env.ENCRYPTION_KEY).digest();

export const encryptText = (value: string) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

export const decryptText = (value: string) => {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

export const encryptJson = (value: unknown) => encryptText(JSON.stringify(value));

export const decryptJson = <T>(value: string): T => JSON.parse(decryptText(value));

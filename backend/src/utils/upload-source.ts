import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { BadRequestException } from './app-error';
import { ProviderUploadFile } from '../providers/storage-provider';

/**
 * Resolve a readable stream for an upload source.
 * Prefers an in-memory buffer (legacy multer memoryStorage) and falls back to a
 * disk temp file (multer diskStorage) so very large files never need full buffering.
 */
export const getUploadStream = (
  file: ProviderUploadFile,
): Readable => {
  if (Buffer.isBuffer(file.buffer)) return Readable.from(file.buffer);
  if (typeof file.path === 'string' && file.path.length > 0) {
    return createReadStream(file.path);
  }
  throw new BadRequestException('Upload source is missing buffer or path');
};

/**
 * Compute a streaming SHA-256 hex digest for an upload source.
 * Returns null for empty/zero-byte sources so callers can skip checksum dedup.
 */
export const computeFileSha256 = async (
  file: ProviderUploadFile,
): Promise<string | null> => {
  if (!file.size) return null;
  const hash = createHash('sha256');
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = getUploadStream(file);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', resolve);
    });
    return hash.digest('hex');
  } catch {
    return null;
  }
};

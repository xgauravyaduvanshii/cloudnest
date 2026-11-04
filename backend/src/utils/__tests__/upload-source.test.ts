/**
 * Unit tests for the streaming upload source helpers.
 *
 * Validates Phase 1 requirement 5 (streaming, no full-memory buffering) and
 * requirement 4 (SHA-256 checksums) at the utility boundary.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import {
  computeFileSha256,
  getUploadStream,
} from '../upload-source';

const sha256Hex = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

const collect = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

describe('getUploadStream', () => {
  it('streams from an in-memory buffer (legacy memoryStorage)', async () => {
    const payload = Buffer.from('hello cloudnest');
    const stream = getUploadStream({
      originalname: 'a.txt',
      mimetype: 'text/plain',
      size: payload.length,
      buffer: payload,
    });
    expect(stream).toBeInstanceOf(Readable);
    const out = await collect(stream);
    expect(out.toString()).toBe('hello cloudnest');
  });

  it('streams from a disk temp file (diskStorage) without buffering it first', async () => {
    const payload = Buffer.from('disk-backed upload contents');
    const tmp = path.join(os.tmpdir(), `cloudnest-test-${Date.now()}.bin`);
    fs.writeFileSync(tmp, payload);
    try {
      const stream = getUploadStream({
        originalname: 'b.bin',
        mimetype: 'application/octet-stream',
        size: payload.length,
        path: tmp,
      });
      const out = await collect(stream);
      expect(out.equals(payload)).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('throws when neither buffer nor path is present', () => {
    expect(() =>
      getUploadStream({
        originalname: 'c.txt',
        mimetype: 'text/plain',
        size: 0,
      }),
    ).toThrow();
  });
});

describe('computeFileSha256', () => {
  it('computes the hex digest for a buffer source', async () => {
    const payload = Buffer.from('checksum me');
    const digest = await computeFileSha256({
      originalname: 'd.txt',
      mimetype: 'text/plain',
      size: payload.length,
      buffer: payload,
    });
    expect(digest).toBe(sha256Hex(payload));
  });

  it('computes the same digest for a disk source as for the buffer', async () => {
    const payload = Buffer.from('same bytes, different transport');
    const tmp = path.join(os.tmpdir(), `cloudnest-sum-${Date.now()}.bin`);
    fs.writeFileSync(tmp, payload);
    try {
      const digest = await computeFileSha256({
        originalname: 'e.bin',
        mimetype: 'application/octet-stream',
        size: payload.length,
        path: tmp,
      });
      expect(digest).toBe(sha256Hex(payload));
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('returns null for zero-byte sources so dedup can be skipped', async () => {
    const digest = await computeFileSha256({
      originalname: 'empty.txt',
      mimetype: 'text/plain',
      size: 0,
      buffer: Buffer.alloc(0),
    });
    expect(digest).toBeNull();
  });
});

/**
 * Phase 4 webhook tests (no network): signature determinism + creation validation.
 */

jest.mock('../../config/env.config', () => ({ Env: { NODE_ENV: 'test' } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../models/webhook.model', () => ({
  __esModule: true,
  default: {
    generateSecret: jest.fn(() => 'whsec_test'),
    create: jest.fn(),
  },
}));

import crypto from 'crypto';
import WebhookModel from '../../models/webhook.model';
import { signWebhookPayload, createWebhookService } from '../webhook.service';

describe('signWebhookPayload', () => {
  it('matches a reference HMAC over `${ts}.${body}`', () => {
    const secret = 'whsec_abc';
    const ts = 1700000000;
    const body = JSON.stringify({ event: 'file.uploaded' });
    const expected = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(signWebhookPayload(secret, ts, body)).toBe(expected);
  });

  it('changes with the timestamp and body', () => {
    const a = signWebhookPayload('s', 1, 'x');
    const b = signWebhookPayload('s', 2, 'x');
    const c = signWebhookPayload('s', 1, 'y');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('createWebhookService validation', () => {
  it('rejects a non-http url', async () => {
    await expect(
      createWebhookService('user-1', { url: 'ftp://nope', events: ['file.uploaded'] }),
    ).rejects.toThrow(/valid http/);
  });

  it('rejects unknown event names', async () => {
    await expect(
      createWebhookService('user-1', { url: 'https://ok.test/hook', events: ['file.exploded'] }),
    ).rejects.toThrow(/Unknown events/);
  });

  it('creates an endpoint and returns the secret exactly once', async () => {
    (WebhookModel.create as jest.Mock).mockResolvedValue({ _id: 'wh1', url: 'https://ok.test/hook' });
    const res = await createWebhookService('user-1', {
      url: 'https://ok.test/hook',
      events: ['file.uploaded', 'file.deleted'],
    });
    expect(res.secret).toBe('whsec_test');
    expect(res.endpoint._id).toBe('wh1');
    // Persisted with the generated signing secret.
    expect((WebhookModel.create as jest.Mock).mock.calls[0][0].secret).toBe('whsec_test');
  });
});

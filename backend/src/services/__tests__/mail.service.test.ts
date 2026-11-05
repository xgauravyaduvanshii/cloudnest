/**
 * Unit tests for the mail service: transport building, active-config resolution
 * (DB config wins over env fallback), template rendering/dispatch, and the
 * fire-and-forget `queueTemplate` contract that must never reject.
 */
import nodemailer from 'nodemailer';
import SmtpConfigModel from '../../models/smtp-config.model';
import EmailTemplateModel from '../../models/email-template.model';
import { Env } from '../../config/env.config';
import { logger } from '../../utils/logger';
import {
  buildTransport,
  queueTemplate,
  resolveActiveConfig,
  sendMail,
  sendTemplate,
  verifySmtpConnection,
} from '../mail.service';

jest.mock('nodemailer');
jest.mock('../../models/smtp-config.model');
jest.mock('../../models/email-template.model');
jest.mock('../../config/env.config', () => ({
  Env: { SMTP_HOST: '', SMTP_PORT: '587', SMTP_SECURE: '', SMTP_USERNAME: '', SMTP_PASSWORD: '', SMTP_FROM_NAME: '', SMTP_FROM_ADDRESS: '', SMTP_REPLY_TO: '' },
}));
jest.mock('../../utils/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));

const mockedCreateTransport = nodemailer.createTransport as unknown as jest.Mock;
const mockedGetActiveRaw = SmtpConfigModel.getActiveRaw as unknown as jest.Mock;
const mockedGetByKey = EmailTemplateModel.getByKey as unknown as jest.Mock;

let mockSendMail: jest.Mock;
let mockVerify: jest.Mock;

const dbConfig = (over = {}) => ({
  id: 'c1',
  name: 'Primary',
  host: 'smtp.db.example',
  port: 587,
  secure: false,
  username: 'db-user',
  password: 'db-pass',
  fromName: 'DB',
  fromAddress: 'db@example.com',
  replyTo: null,
  ...over,
});

const template = (over = {}) => ({
  id: 't1',
  key: 'welcome',
  name: 'Welcome',
  subject: 'Hello {{userName}}',
  htmlBody: '<p>Hi {{userName}} code {{otpCode}}</p>',
  textBody: 'Hi {{userName}} code {{otpCode}}',
  description: null,
  variables: ['userName', 'otpCode'],
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetActiveRaw.mockResolvedValue(null);
  mockedGetByKey.mockResolvedValue(null);
  mockSendMail = jest.fn().mockResolvedValue({ messageId: 'm1' });
  mockVerify = jest.fn().mockResolvedValue(true);
  mockedCreateTransport.mockReturnValue({ sendMail: mockSendMail, verify: mockVerify });
  (Env as Record<string, string>).SMTP_HOST = '';
  (Env as Record<string, string>).SMTP_FROM_ADDRESS = '';
});

describe('buildTransport', () => {
  it('passes host/port/secure/auth to nodemailer', () => {
    buildTransport(dbConfig({ host: 'h', port: 465, secure: true, username: 'u', password: 'p' }) as never);
    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'h', port: 465, secure: true, auth: { user: 'u', pass: 'p' } }),
    );
  });

  it('omits auth when there is no username', () => {
    buildTransport(dbConfig({ username: null, password: null }) as never);
    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
    );
  });
});

describe('resolveActiveConfig', () => {
  it('prefers the active DB configuration over the env fallback', async () => {
    const cfg = dbConfig();
    mockedGetActiveRaw.mockResolvedValue(cfg);
    (Env as Record<string, string>).SMTP_HOST = 'smtp.env.example';
    (Env as Record<string, string>).SMTP_FROM_ADDRESS = 'env@example.com';
    await expect(resolveActiveConfig()).resolves.toEqual(cfg);
  });

  it('falls back to env when no active DB config exists', async () => {
    mockedGetActiveRaw.mockResolvedValue(null);
    (Env as Record<string, string>).SMTP_HOST = 'smtp.env.example';
    (Env as Record<string, string>).SMTP_FROM_ADDRESS = 'env@example.com';
    (Env as Record<string, string>).SMTP_PORT = '465';
    (Env as Record<string, string>).SMTP_SECURE = 'true';
    const cfg = await resolveActiveConfig();
    expect(cfg).toMatchObject({ host: 'smtp.env.example', fromAddress: 'env@example.com', port: 465, secure: true });
  });

  it('returns null when neither DB nor env is configured', async () => {
    mockedGetActiveRaw.mockResolvedValue(null);
    await expect(resolveActiveConfig()).resolves.toBeNull();
  });
});

describe('verifySmtpConnection', () => {
  it('opens and closes a connection via transport.verify', async () => {
    await verifySmtpConnection(dbConfig() as never);
    expect(mockVerify).toHaveBeenCalled();
  });
});

describe('sendMail', () => {
  it('throws MAIL_NOT_CONFIGURED when nothing is configured', async () => {
    mockedGetActiveRaw.mockResolvedValue(null);
    await expect(
      sendMail({ to: 'a@b.com', subject: 's', html: 'h', text: 't' }),
    ).rejects.toMatchObject({ errorCode: 'MAIL_NOT_CONFIGURED' });
    expect(mockedCreateTransport).not.toHaveBeenCalled();
  });

  it('builds the from header and sends the message', async () => {
    mockedGetActiveRaw.mockResolvedValue(dbConfig());
    await sendMail({ to: 'a@b.com', subject: 's', html: 'h', text: 't' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'DB <db@example.com>', to: 'a@b.com', subject: 's', html: 'h', text: 't' }),
    );
  });
});

describe('sendTemplate', () => {
  it('renders subject/html/text from the template and sends', async () => {
    mockedGetActiveRaw.mockResolvedValue(dbConfig());
    mockedGetByKey.mockResolvedValue(template());
    await sendTemplate('welcome', 'a@b.com', { userName: 'Ada', otpCode: '123456' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hello Ada',
        html: '<p>Hi Ada code 123456</p>',
        text: 'Hi Ada code 123456',
      }),
    );
  });

  it('throws NotFound when the template is missing', async () => {
    mockedGetByKey.mockResolvedValue(null);
    await expect(sendTemplate('nope', 'a@b.com', {})).rejects.toBeInstanceOf(Error);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('throws BadRequest when the template is disabled', async () => {
    mockedGetByKey.mockResolvedValue(template({ isEnabled: false }));
    await expect(sendTemplate('welcome', 'a@b.com', {})).rejects.toBeInstanceOf(Error);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('fills the footer currentYear placeholder at send time', async () => {
    mockedGetActiveRaw.mockResolvedValue(dbConfig());
    mockedGetByKey.mockResolvedValue(
      template({
        htmlBody: '<p>&copy; {{currentYear}} CloudNest</p>',
        textBody: '(c) {{currentYear}} CloudNest',
      }),
    );
    await sendTemplate('welcome', 'a@b.com', { userName: 'Ada' });
    const year = String(new Date().getFullYear());
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: `<p>&copy; ${year} CloudNest</p>`,
        text: `(c) ${year} CloudNest`,
      }),
    );
  });
});

describe('queueTemplate (fire-and-forget)', () => {
  it('returns void and swallows delivery errors', async () => {
    mockedGetByKey.mockResolvedValue(template());
    mockedGetActiveRaw.mockResolvedValue(null); // sendMail -> MAIL_NOT_CONFIGURED
    const ret = queueTemplate('welcome', 'a@b.com', { userName: 'Ada' });
    expect(ret).toBeUndefined();
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalled();
  });

  it('does nothing without a recipient', async () => {
    queueTemplate('welcome', '', {});
    await new Promise((r) => setImmediate(r));
    expect(mockedGetByKey).not.toHaveBeenCalled();
  });
});

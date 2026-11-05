/**
 * Auth OTP flow tests: pending sign-up, verification (happy/expired/wrong/
 * max-attempts), resend rotation, and the login gate that blocks unverified
 * accounts. Model + mail layers are mocked so this exercises only the service
 * logic and its state transitions.
 */
import UserModel from '../../models/user.model';
import StorageModel from '../../models/storage.model';
import EmailVerificationModel from '../../models/email-verification.model';
import { withTransaction } from '../../config/database.config';
import { signJwtToken } from '../../utils/jwt';
import { randomCode } from '../../utils/token';
import { sendTemplate, queueTemplate } from '../mail.service';
import {
  loginService,
  registerService,
  resendSignupOtpService,
  verifySignupOtpService,
} from '../auth.service';

jest.mock('../../models/user.model');
jest.mock('../../models/storage.model');
jest.mock('../../models/email-verification.model');
jest.mock('../../models/admin-audit.model', () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../config/database.config');
jest.mock('../../config/env.config', () => ({
  Env: {
    NODE_ENV: 'test',
    CLIENT_URL: 'http://localhost:5173',
    OTP_TTL_MINUTES: '15',
    MAGIC_LINK_TTL_MINUTES: '15',
    PASSWORD_RESET_TTL_MINUTES: '30',
    SMTP_HOST: '',
    SMTP_FROM_ADDRESS: '',
  },
}));
jest.mock('../../utils/jwt');
jest.mock('../../utils/bcrypt', () => ({
  hashValue: jest.fn().mockResolvedValue('hashed'),
}));
jest.mock('../../utils/token', () => ({
  randomCode: jest.fn().mockReturnValue('654321'),
  randomToken: jest.fn().mockReturnValue('tok'),
  sha256: (s: string) => `sha:${s}`,
  secureEquals: (a: string, b: string) => a === b,
}));
jest.mock('../mail.service', () => ({
  sendTemplate: jest.fn().mockResolvedValue(undefined),
  queueTemplate: jest.fn(),
}));

const m = (x: unknown) => x as jest.Mock;

const userDoc = (over = {}) => ({
  _id: 'u1',
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  password: 'hashed',
  profilePicture: null,
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: false,
  comparePassword: jest.fn().mockResolvedValue(true),
  omitPassword: () => ({ id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'USER', status: 'ACTIVE' }),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  m(withTransaction).mockImplementation(async (cb: any) => cb({}));
  m(StorageModel.createForUser).mockResolvedValue(undefined);
  m(signJwtToken).mockReturnValue({ token: 'jwt', expiresAt: 123 });
  m(randomCode).mockReturnValue('654321');
  m(sendTemplate).mockResolvedValue(undefined);
});

describe('registerService', () => {
  it('creates a pending user and emails a signup OTP', async () => {
    m(UserModel.findByEmail).mockResolvedValue(null);
    m(UserModel.create).mockResolvedValue(userDoc());

    const res = await registerService({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    } as never);

    expect(res).toMatchObject({ email: 'ada@example.com', pendingVerification: true });
    expect(UserModel.create).toHaveBeenCalled();
    expect(EmailVerificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'signup_otp', codeHash: 'sha:654321' }),
    );
    expect(sendTemplate).toHaveBeenCalledWith(
      'signup_otp',
      'ada@example.com',
      expect.objectContaining({ otpCode: '654321' }),
    );
  });

  it('rejects when the email is already verified', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: true }));
    await expect(
      registerService({ name: 'Ada', email: 'ada@example.com', password: 'secret123' } as never),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_CONFLICT' });
  });
});

describe('verifySignupOtpService', () => {
  it('verifies, activates the account, and auto-logs-in', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    m(EmailVerificationModel.findActiveByEmailPurpose).mockResolvedValue({
      id: 'v1',
      codeHash: 'sha:654321',
      attempts: 0,
    });
    m(UserModel.setEmailVerified).mockResolvedValue(userDoc({ emailVerified: true }));

    const res = await verifySignupOtpService({ email: 'ada@example.com', code: '654321' } as never);

    expect(res).toMatchObject({ accessToken: 'jwt' });
    expect(EmailVerificationModel.consume).toHaveBeenCalledWith('v1');
    expect(UserModel.setEmailVerified).toHaveBeenCalledWith('u1', true);
    expect(queueTemplate).toHaveBeenCalledWith('welcome', 'ada@example.com', expect.anything());
    expect(queueTemplate).toHaveBeenCalledWith('signup_success', 'ada@example.com', expect.anything());
  });

  it('throws AUTH_INVALID_OTP and records an attempt on a wrong code', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    m(EmailVerificationModel.findActiveByEmailPurpose).mockResolvedValue({
      id: 'v1',
      codeHash: 'sha:654321',
      attempts: 0,
    });

    await expect(
      verifySignupOtpService({ email: 'ada@example.com', code: '000000' } as never),
    ).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' });
    expect(EmailVerificationModel.incrementAttempts).toHaveBeenCalledWith('v1');
    expect(UserModel.setEmailVerified).not.toHaveBeenCalled();
  });

  it('throws AUTH_LINK_EXPIRED when no active code exists', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    m(EmailVerificationModel.findActiveByEmailPurpose).mockResolvedValue(null);

    await expect(
      verifySignupOtpService({ email: 'ada@example.com', code: '654321' } as never),
    ).rejects.toMatchObject({ errorCode: 'AUTH_LINK_EXPIRED' });
  });

  it('throws AUTH_TOO_MANY_ATTEMPTS once the attempt ceiling is reached', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    m(EmailVerificationModel.findActiveByEmailPurpose).mockResolvedValue({
      id: 'v1',
      codeHash: 'sha:654321',
      attempts: 5,
    });

    await expect(
      verifySignupOtpService({ email: 'ada@example.com', code: '654321' } as never),
    ).rejects.toMatchObject({ errorCode: 'AUTH_TOO_MANY_ATTEMPTS' });
  });

  it('short-circuits to a session when already verified', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: true }));
    const res = await verifySignupOtpService({ email: 'ada@example.com', code: '654321' } as never);
    expect(res).toMatchObject({ accessToken: 'jwt' });
    expect(EmailVerificationModel.findActiveByEmailPurpose).not.toHaveBeenCalled();
  });
});

describe('resendSignupOtpService', () => {
  it('issues a freshly-rotated code for an unverified account', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    m(randomCode).mockReturnValue('111222');

    const res = await resendSignupOtpService({ email: 'ada@example.com' } as never);

    expect(res).toMatchObject({ email: 'ada@example.com', sent: true });
    expect(EmailVerificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'signup_otp', codeHash: 'sha:111222' }),
    );
    expect(sendTemplate).toHaveBeenCalledWith(
      'signup_otp',
      'ada@example.com',
      expect.objectContaining({ otpCode: '111222' }),
    );
  });

  it('rejects resending for an already-verified account', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: true }));
    await expect(
      resendSignupOtpService({ email: 'ada@example.com' } as never),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_CONFLICT' });
  });
});

describe('loginService email gate', () => {
  it('blocks sign-in until the email is verified', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: false }));
    await expect(
      loginService({ email: 'ada@example.com', password: 'secret123' } as never),
    ).rejects.toMatchObject({ errorCode: 'AUTH_EMAIL_NOT_VERIFIED' });
  });

  it('allows sign-in and sends a new-device notice once verified', async () => {
    m(UserModel.findByEmail).mockResolvedValue(userDoc({ emailVerified: true }));
    const res = await loginService({ email: 'ada@example.com', password: 'secret123' } as never);
    expect(res).toMatchObject({ accessToken: 'jwt' });
    expect(queueTemplate).toHaveBeenCalledWith('login_new_device', 'ada@example.com', expect.anything());
  });
});

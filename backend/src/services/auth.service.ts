import {
  ForgotPasswordSchemaType,
  LoginSchemaType,
  RegisterSchemaType,
  ResendOtpSchemaType,
  ResetPasswordSchemaType,
  VerifyOtpSchemaType,
} from '../validators/auth.validator';
import UserModel, { UserDocument } from '../models/user.model';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';
import StorageModel from '../models/storage.model';
import EmailVerificationModel from '../models/email-verification.model';
import AdminAuditModel from '../models/admin-audit.model';
import { signJwtToken } from '../utils/jwt';
import { withTransaction } from '../config/database.config';
import { hashValue } from '../utils/bcrypt';
import { randomCode, randomToken, sha256, secureEquals } from '../utils/token';
import { queueTemplate, sendTemplate } from './mail.service';
import { Env } from '../config/env.config';
import { ErrorCodeEnum } from '../enums/error-code.enum';

const MAX_OTP_ATTEMPTS = 5;

const minutesFromEnv = (value: string, fallback: number) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const expiry = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000);

const buildSession = (user: UserDocument) => {
  const { token, expiresAt } = signJwtToken({ userId: user.id });
  return {
    user: user.omitPassword(),
    accessToken: token,
    expiresAt,
  };
};

// ---------------------------------------------------------------- sign-up OTP

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body;

  const userId = await withTransaction(async (client) => {
    const existingUser = await UserModel.findByEmail(email, client);
    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new ConflictException('User already exists');
      }
      // Unverified duplicate: fall through to re-issue a code below.
    }

    if (existingUser) {
      await StorageModel.createForUser(existingUser._id, client).catch(() => null);
      return existingUser._id;
    }

    const newUser = await UserModel.create(
      { ...body, profilePicture: body.profilePicture || null },
      client,
    );
    await StorageModel.createForUser(newUser._id, client);
    return newUser._id;
  });

  // Deliver the code outside the transaction so a slow/failing SMTP send never
  // holds a DB lock. The account stays pending until the OTP is verified.
  const ttl = minutesFromEnv(Env.OTP_TTL_MINUTES, 15);
  const code = randomCode(6);
  await EmailVerificationModel.create({
    userId,
    email,
    purpose: 'signup_otp',
    codeHash: sha256(code),
    expiresAt: expiry(ttl),
  });
  await sendTemplate('signup_otp', email, {
    userName: body.name,
    otpCode: code,
    expiresMinutes: ttl,
  });

  return { email, pendingVerification: true, expiresMinutes: ttl };
};

export const verifySignupOtpService = async (body: VerifyOtpSchemaType) => {
  const { email, code } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException('Account not found');

  if (user.emailVerified) {
    return buildSession(user);
  }

  const verification = await EmailVerificationModel.findActiveByEmailPurpose(
    email,
    'signup_otp',
  );
  if (!verification || !verification.codeHash) {
    throw new UnauthorizedException(
      'Verification code expired. Request a new one.',
      ErrorCodeEnum.AUTH_LINK_EXPIRED,
    );
  }
  if (verification.attempts >= MAX_OTP_ATTEMPTS) {
    throw new UnauthorizedException(
      'Too many attempts. Request a new code.',
      ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS,
    );
  }
  if (!secureEquals(sha256(code), verification.codeHash)) {
    await EmailVerificationModel.incrementAttempts(verification.id);
    throw new UnauthorizedException(
      'Invalid verification code',
      ErrorCodeEnum.AUTH_INVALID_OTP,
    );
  }

  await EmailVerificationModel.consume(verification.id);
  const updated = await UserModel.setEmailVerified(user.id, true);
  if (!updated) throw new NotFoundException('Account not found');

  queueTemplate('welcome', email, {
    userName: updated.name,
    appUrl: Env.CLIENT_URL,
  });
  queueTemplate('signup_success', email, {
    userName: updated.name,
    email,
  });

  return buildSession(updated);
};

export const resendSignupOtpService = async (body: ResendOtpSchemaType) => {
  const { email } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException('Account not found');
  if (user.emailVerified) {
    throw new ConflictException('Email is already verified');
  }

  const ttl = minutesFromEnv(Env.OTP_TTL_MINUTES, 15);
  const code = randomCode(6);
  await EmailVerificationModel.create({
    userId: user.id,
    email,
    purpose: 'signup_otp',
    codeHash: sha256(code),
    expiresAt: expiry(ttl),
  });
  await sendTemplate('signup_otp', email, {
    userName: user.name,
    otpCode: code,
    expiresMinutes: ttl,
  });

  return { email, sent: true, expiresMinutes: ttl };
};

// ---------------------------------------------------------------------- login

export const loginService = async (body: LoginSchemaType) => {
  const { email, password } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException('Email/Password not found');
  if (user.status === 'DISABLED') {
    throw new UnauthorizedException('User account is disabled');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Email/Password is incorrect');
  }

  if (!user.emailVerified) {
    throw new UnauthorizedException(
      'Please verify your email before signing in.',
      ErrorCodeEnum.AUTH_EMAIL_NOT_VERIFIED,
    );
  }

  queueTemplate('login_new_device', user.email, {
    userName: user.name,
    dateTime: new Date().toLocaleString(),
  });

  return buildSession(user);
};

// ------------------------------------------------------------- password reset

export const forgotPasswordService = async (body: ForgotPasswordSchemaType) => {
  const { email } = body;
  const user = await UserModel.findByEmail(email);
  // Enumeration-safe: always report success, only act when the account exists.
  if (!user) return { sent: true };

  const ttl = minutesFromEnv(Env.PASSWORD_RESET_TTL_MINUTES, 30);
  const token = randomToken();
  await EmailVerificationModel.create({
    userId: user.id,
    email,
    purpose: 'password_reset',
    tokenHash: sha256(token),
    expiresAt: expiry(ttl),
  });
  queueTemplate('password_reset', email, {
    userName: user.name,
    resetLink: `${Env.CLIENT_URL}/reset-password?token=${token}`,
    expiresMinutes: ttl,
  });

  return { sent: true };
};

export const resetPasswordService = async (body: ResetPasswordSchemaType) => {
  const { token, password } = body;
  const verification = await EmailVerificationModel.findActiveByTokenHash(
    sha256(token),
    'password_reset',
  );
  if (!verification) {
    throw new UnauthorizedException(
      'This reset link is invalid or has expired.',
      ErrorCodeEnum.AUTH_LINK_EXPIRED,
    );
  }

  await EmailVerificationModel.consume(verification.id);
  const hashed = await hashValue(password);
  const updated = await UserModel.updatePassword(verification.userId, hashed);
  if (!updated) throw new NotFoundException('Account not found');

  queueTemplate('signup_success', verification.email, {
    userName: updated.name,
    email: verification.email,
  });

  return { reset: true };
};

// ---------------------------------------------------------------- magic links

export const adminSendMagicLinkService = async (
  adminId: string | undefined,
  userId: string,
) => {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundException('User not found');

  const ttl = minutesFromEnv(Env.MAGIC_LINK_TTL_MINUTES, 15);
  const token = randomToken();
  await EmailVerificationModel.create({
    userId: user.id,
    email: user.email,
    purpose: 'magic_link',
    tokenHash: sha256(token),
    expiresAt: expiry(ttl),
  });
  // Awaited so the admin learns whether delivery actually succeeded.
  await sendTemplate('magic_link', user.email, {
    userName: user.name,
    magicLink: `${Env.CLIENT_URL}/magic-link?token=${token}`,
    expiresMinutes: ttl,
  });

  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    targetUserId: user.id,
    action: 'admin.user.magic_link',
    entityType: 'users',
    entityId: user.id,
    metadata: { email: user.email },
  }).catch(() => null);

  return { sent: true, expiresMinutes: ttl };
};

export const verifyMagicLinkService = async (token: string) => {
  const verification = await EmailVerificationModel.findActiveByTokenHash(
    sha256(token),
    'magic_link',
  );
  if (!verification) {
    throw new UnauthorizedException(
      'This sign-in link is invalid or has expired.',
      ErrorCodeEnum.AUTH_LINK_EXPIRED,
    );
  }

  const user = await UserModel.findById(verification.userId);
  if (!user) throw new NotFoundException('Account not found');
  if (user.status === 'DISABLED') {
    throw new UnauthorizedException('User account is disabled');
  }

  await EmailVerificationModel.consume(verification.id);
  if (!user.emailVerified) {
    await UserModel.setEmailVerified(user.id, true);
  }

  queueTemplate('login_new_device', user.email, {
    userName: user.name,
    dateTime: new Date().toLocaleString(),
  });

  return buildSession(user);
};

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkVerifySchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '../validators/auth.validator';
import { HTTPSTATUS } from '../config/http.config';
import {
  adminSendMagicLinkService,
  forgotPasswordService,
  loginService,
  registerService,
  resendSignupOtpService,
  resetPasswordService,
  verifyMagicLinkService,
  verifySignupOtpService,
} from '../services/auth.service';

export const registerController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body);

    const result = await registerService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Verification code sent. Check your email to activate your account.',
      ...result,
    });
  },
);

export const verifyOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = verifyOtpSchema.parse(req.body);

    const result = await verifySignupOtpService(body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Email verified successfully',
      ...result,
    });
  },
);

export const resendOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = resendOtpSchema.parse(req.body);

    const result = await resendSignupOtpService(body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Verification code sent',
      ...result,
    });
  },
);

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body);

    const result = await loginService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'User logged in successfully',
      ...result,
    });
  },
);

export const forgotPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = forgotPasswordSchema.parse(req.body);

    const result = await forgotPasswordService(body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'If an account exists for that email, a reset link has been sent.',
      ...result,
    });
  },
);

export const resetPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = resetPasswordSchema.parse(req.body);

    const result = await resetPasswordService(body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Password reset successfully',
      ...result,
    });
  },
);

export const verifyMagicLinkController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = magicLinkVerifySchema.parse(req.body);

    const result = await verifyMagicLinkService(body.token);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Signed in successfully',
      ...result,
    });
  },
);

export const adminSendMagicLinkController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const result = await adminSendMagicLinkService(req.user!._id, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Magic link sent',
      ...result,
    });
  },
);

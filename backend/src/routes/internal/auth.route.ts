import { Router } from 'express';
import {
  forgotPasswordController,
  loginController,
  registerController,
  resendOtpController,
  resetPasswordController,
  verifyMagicLinkController,
  verifyOtpController,
} from '../../controllers/auth.controller';

const authRoutes = Router();

authRoutes.post('/register', registerController);
authRoutes.post('/verify-email', verifyOtpController);
authRoutes.post('/resend-verification', resendOtpController);
authRoutes.post('/login', loginController);
authRoutes.post('/forgot-password', forgotPasswordController);
authRoutes.post('/reset-password', resetPasswordController);
authRoutes.post('/magic-link/verify', verifyMagicLinkController);

export default authRoutes;

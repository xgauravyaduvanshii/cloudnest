import { NextFunction, Request, Response } from 'express';
import { ForbiddenException, UnauthorizedException } from '../utils/app-error';

export const adminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return next(new UnauthorizedException('Unauthorized access'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new ForbiddenException('Admin access required'));
  }

  next();
};

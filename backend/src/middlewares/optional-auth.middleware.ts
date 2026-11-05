import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

/**
 * Attempts to resolve the authenticated user from a bearer token but NEVER rejects
 * the request. Used on public endpoints (e.g. the contact form) so a submission can
 * be linked to a logged-in user when a valid token is present, while still allowing
 * fully anonymous submissions.
 */
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};

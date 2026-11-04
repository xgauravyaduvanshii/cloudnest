import { NextFunction, Request, Response } from 'express';
import { ForbiddenException, UnauthorizedException } from '../utils/app-error';

/**
 * Guards a route behind required API-key scopes. Only applies to API-key
 * authenticated requests (req.apiKey set by apiKeyAuthMiddleware); JWT-authenticated
 * internal requests already carry full user privileges and pass through.
 */
export const requireScopes =
  (...required: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey) return next(); // Not an API-key request; JWT user path.
    const granted = req.apiKey.scopes ?? [];
    const missing = required.filter((scope) => !granted.includes(scope));
    if (missing.length) {
      return next(
        new ForbiddenException(`API key missing required scope(s): ${missing.join(', ')}`),
      );
    }
    next();
  };

/** Ensures the request was made with an API key at all (used by scoped v1 writes). */
export const requireApiKey = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.apiKey) return next(new UnauthorizedException('API key authentication required'));
  next();
};

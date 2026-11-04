import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../utils/app-error';
import { HTTPSTATUS } from '../config/http.config';
import { Env } from '../config/env.config';

type Counter = { count: number; resetAt: number };

/**
 * Minimal fixed-window rate limiter with no external dependency. Suitable for
 * throttling API-key traffic per key (or per IP as a fallback). The store is
 * injectable so it can be unit tested deterministically.
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  store?: Map<string, Counter>;
}

export const createRateLimit = (options: RateLimitOptions) => {
  const { windowMs, max } = options;
  const store = options.store ?? new Map<string, Counter>();
  const keyFn =
    options.keyFn ??
    ((req: Request) => req.apiKey?.id ?? req.ip ?? 'unknown');

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const err = new HttpException('Too many requests', HTTPSTATUS.TOO_MANY_REQUESTS);
      return next(err);
    }
    next();
  };
};

/** Shared limiter for the public v1 API surface. */
export const v1RateLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(Env.API_RATE_LIMIT_PER_MIN || 120),
});

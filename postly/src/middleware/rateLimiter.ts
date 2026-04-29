
import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { errorResponse } from '../utils/response';

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_REQUESTS = 100;

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    // Test suites should not require Redis to be available.
    next();
    return;
  }

  // Use user ID if authenticated, otherwise fall back to IP
  const identifier = req.user?.id ?? req.ip ?? 'anonymous';
  const key = `rate:${identifier}`;

  try {
    // Increment counter; set expiry on first hit
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    // Attach rate limit headers so clients know their remaining budget
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));

    if (current > MAX_REQUESTS) {
      res.status(429).json(errorResponse('Rate limit exceeded — try again in 15 minutes', 'RATE_LIMITED'));
      return;
    }

    next();
  } catch {
    // If Redis is unavailable, fail open (don't block the request)
    // Log the error but don't expose it to the user
    next();
  }
}

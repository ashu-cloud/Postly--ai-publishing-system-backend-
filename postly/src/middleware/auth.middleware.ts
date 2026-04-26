/**
 * src/middleware/auth.middleware.ts
 *
 * JWT Bearer token verification middleware.
 * Applied to all protected routes — no exceptions.
 *
 * Error handling rules (intentionally strict):
 *   - No Authorization header   → 401 UNAUTHORIZED
 *   - Token expired             → 401 UNAUTHORIZED  (TokenExpiredError)
 *   - Invalid signature/format  → 403 FORBIDDEN     (JsonWebTokenError)
 *   - Valid token               → attaches req.user and calls next()
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../types';
import { AuthError, ForbiddenError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { env } from '../config/env';

// Extend Express Request type to carry our user payload
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Must be "Bearer <token>" format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('Authentication token required', 'UNAUTHORIZED'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    // Attach minimal user info — avoid carrying sensitive data on every request
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // Expired — let client know they need a refresh
      res.status(401).json(errorResponse('Token expired — please refresh', 'TOKEN_EXPIRED'));
      return;
    }
    // Invalid signature or malformed — could be an attack, return 403
    res.status(403).json(errorResponse('Invalid authentication token', 'INVALID_TOKEN'));
  }
}

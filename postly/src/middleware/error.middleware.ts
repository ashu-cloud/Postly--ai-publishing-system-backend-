
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { logger } from '../config/logger';

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Our own typed errors — safe to expose message
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.code));
    return;
  }

  // Prisma unique constraint violation (e.g., duplicate email on register)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json(errorResponse('A record with this value already exists', 'CONFLICT'));
    return;
  }

  // Prisma record not found
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json(errorResponse('Record not found', 'NOT_FOUND'));
    return;
  }

  // Unknown error — log full details internally, return generic message externally
  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json(
    errorResponse(
      isProd ? 'Internal server error' : (err instanceof Error ? err.message : 'Unknown error'),
      'INTERNAL_ERROR'
    )
  );
}

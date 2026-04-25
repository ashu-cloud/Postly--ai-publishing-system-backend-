/**
 * src/config/database.ts
 *
 * Prisma Client singleton. We instantiate once and reuse across the app.
 * In serverless environments each invocation would get a fresh client,
 * so we attach to `globalThis` in development to survive HMR restarts.
 */

import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma Client instances during ts-node-dev hot reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

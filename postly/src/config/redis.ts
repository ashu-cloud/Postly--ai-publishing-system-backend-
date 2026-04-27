/**
 * src/config/redis.ts
 *
 * ioredis client singleton shared by:
 *   - BullMQ queues and workers (requires a dedicated connection per queue)
 *   - Bot session state (bot:session:{chatId})
 *   - Rate limiter (sliding window counters)
 *
 * BullMQ requires its own connection instances (it hijacks the connection
 * for BLPOP blocking commands). We export a factory `createRedisConnection`
 * alongside the shared `redis` instance for general use.
 */

import Redis from 'ioredis';

const isTest = process.env.NODE_ENV === 'test';

// Shared redis client for non-BullMQ usage (sessions, rate limiting)
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ when used as queue connection
  enableReadyCheck: false,
  lazyConnect: true,
});

if (!isTest) {
  redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log('[Redis] Connected');
  });
}

/**
 * Factory for BullMQ — each Queue and Worker needs its own connection.
 * BullMQ uses blocking commands that monopolise a connection.
 */
export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

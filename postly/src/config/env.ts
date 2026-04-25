/**
 * src/config/env.ts
 *
 * Validates all required environment variables at startup using Zod.
 * If any required variable is missing or invalid, the process exits immediately
 * with a descriptive error — far better than cryptic runtime failures later.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file before validation
dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Encryption — AES-256 requires exactly 32 bytes = 64 hex chars
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  WEBHOOK_URL: z.string().optional(),

  // AI keys — each has a dedicated provider, never mixed
  OPENAI_KEY: z.string().min(1, 'OPENAI_KEY is required'),
  CLAUDE_API_KEY: z.string().min(1, 'CLAUDE_API_KEY is required'),

  // Platform keys — optional, enables real publishing
  TWITTER_BEARER_TOKEN: z.string().optional(),
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _parsed.data;
export type Env = typeof env;

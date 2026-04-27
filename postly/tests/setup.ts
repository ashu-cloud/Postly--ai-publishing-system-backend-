/**
 * tests/setup.ts
 *
 * Jest setup file — runs before all tests.
 * Sets test environment variables so env.ts validation passes.
 */

// Set minimal env vars needed for app to initialize in test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postly:postly@localhost:5432/postly_test?connect_timeout=2';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-chars-long!';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
// 64 hex chars = 32 bytes — valid for AES-256-GCM
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'test-bot-token-12345';
process.env.OPENAI_KEY = process.env.OPENAI_KEY ?? 'test-openai-key';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY ?? 'test-claude-key';

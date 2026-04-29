
import './config/env'; // Validate env vars before anything else
import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './config/logger';
import { startScheduler } from './queue/scheduler';

import './queue/worker';

async function main() {

  await prisma.$connect();
  logger.info('[DB] PostgreSQL connected');

  await redis.connect();

  startScheduler();

  const port = env.PORT;
  app.listen(port, () => {
    logger.info(`[Server] Postly API running on port ${port} (${env.NODE_ENV})`);
  });

  const { bot } = await import('./modules/bot/bot');

  if (env.WEBHOOK_URL) {
    const webhookUrl = `${env.WEBHOOK_URL.replace(/\/$/, '')}/api/bot/webhook`;
    try {
      // Clear any stale polling session before registering webhook
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      await bot.api.setWebhook(webhookUrl);
      logger.info(`[Bot] Webhook set: ${webhookUrl}`);
    } catch (err) {
      logger.error('[Bot] Failed to configure webhook', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info('[Bot] No WEBHOOK_URL set — starting long polling (dev only)');
    bot.start({
      onStart: (_botInfo) => { logger.info('[Bot] Long polling started'); },
    });
  }

  const shutdown = async (signal: string) => {
    logger.info(`[Server] ${signal} received — shutting down gracefully`);
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('[Server] Fatal startup error', { error: (err as Error).message });
  process.exit(1);
});

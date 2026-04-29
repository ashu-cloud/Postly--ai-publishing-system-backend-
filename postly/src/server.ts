
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

  if (env.NODE_ENV === 'production') {

    logger.info('[Bot] Production mode — using webhook');

    if (env.WEBHOOK_URL) {
      const { bot } = await import('./modules/bot/bot');
      const webhookUrl = `${env.WEBHOOK_URL.replace(/\/$/, '')}/api/bot/webhook`;
      try {
        await bot.api.setWebhook(webhookUrl);
        logger.info(`[Bot] Webhook configured: ${webhookUrl}`);
      } catch (err) {
        logger.error('[Bot] Failed to configure webhook', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      logger.warn('[Bot] WEBHOOK_URL is not set — webhook registration skipped');
    }
  } else {

    const { bot } = await import('./modules/bot/bot');
    bot.start({
      onStart: (_botInfo) => { logger.info('[Bot] Development mode — long polling started'); },
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

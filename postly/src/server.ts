
import './config/env'; // Validate env vars before anything else
import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './config/logger';
import { startScheduler } from './queue/scheduler';

import './queue/worker';
import { bot } from './modules/bot/bot';

async function main() {

  await prisma.$connect();
  logger.info('[DB] PostgreSQL connected');

  await redis.connect();

  startScheduler();

  const port = env.PORT;
  app.listen(port, () => {
    logger.info(`[Server] Postly API running on port ${port} (${env.NODE_ENV})`);
  });

  if (env.WEBHOOK_URL) {
    const webhookUrl = `${env.WEBHOOK_URL.replace(/\/$/, '')}/api/bot/webhook`;

    if (env.NODE_ENV === 'development') {
      logger.warn('[Bot] WEBHOOK_URL is set in development mode. This will override any production webhook. Unset WEBHOOK_URL locally to use long polling instead.');
    }

    try {
      // Set webhook directly — Telegram replaces existing webhook atomically, no need to delete first.
      // Calling deleteWebhook before this step is dangerous: if the server crashes between the two calls,
      // the webhook is permanently lost until the next successful setWebhook call.
      await bot.api.setWebhook(webhookUrl, {
        secret_token: process.env.TELEGRAM_SECRET_TOKEN,
        drop_pending_updates: false,
      });
      logger.info(`[Bot] Webhook set: ${webhookUrl} (Security Token: ${process.env.TELEGRAM_SECRET_TOKEN ? 'Enabled' : 'Disabled'})`);
    } catch (err) {
      logger.error('[Bot] Failed to configure webhook', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info('[Bot] No WEBHOOK_URL set — starting long polling');
    bot.start({
      onStart: (botInfo) => {
        logger.info(`[Bot] Long polling started as @${botInfo.username}`);
      },
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

/**
 * src/modules/bot/bot.routes.ts
 *
 * Webhook endpoint for Telegram updates in production.
 * In development, the bot runs in polling mode (see server.ts).
 *
 * To register the webhook:
 *   curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url={WEBHOOK_URL}/api/bot/webhook"
 */

import { Router } from 'express';
import { webhookCallback } from 'grammy';
import { bot } from './bot';

const router = Router();

// POST /api/bot/webhook — receives Telegram update objects
// grammy's webhookCallback handles JSON parsing and bot dispatch internally
router.post('/webhook', webhookCallback(bot, 'express'));

export default router;

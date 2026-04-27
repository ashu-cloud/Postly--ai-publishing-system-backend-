/**
 * src/modules/bot/bot.middleware.ts
 *
 * Bot middleware utilities — session management context.
 */

import { Context } from 'grammy';
import { getSession, setSession } from './bot';
import type { BotSession } from '../../types';

/**
 * Express-style middleware that loads the bot session from Redis
 * and attaches it to the context for easy access.
 * Usage: bot.use(sessionMiddleware);
 */
export async function sessionMiddleware(
  ctx: Context & { session?: BotSession },
  next: () => Promise<void>
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId) {
    ctx.session = (await getSession(chatId)) ?? undefined;
  }
  await next();
  // Persist any changes made during request processing
  if (chatId && ctx.session) {
    await setSession(chatId, ctx.session);
  }
}

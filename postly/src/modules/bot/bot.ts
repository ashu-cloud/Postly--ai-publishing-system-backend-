/**
 * src/modules/bot/bot.ts
 *
 * grammy Bot instance.
 * This module exports the bot singleton and wires up all commands/conversations.
 *
 * Why grammy over node-telegram-bot-api:
 *   - TypeScript-native (full type safety on contexts, callbacks, inline keyboards)
 *   - Better middleware model — similar to Express, composable
 *   - Cleaner webhook + polling switchover
 *   - Built-in session support compatible with external stores (Redis)
 */

import { Bot, InlineKeyboard } from 'grammy';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { BotSession, BotStep } from '../../types';
import { handlePublishConversation, handleCallbackQuery } from './conversations/publish.conversation';
import { startCommand } from './commands/start.command';
import { statusCommand } from './commands/status.command';
import { accountsCommand } from './commands/accounts.command';
import { helpCommand } from './commands/help.command';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// ---- Session helpers -----------------------------------------------

const SESSION_PREFIX = 'bot:session';
const SESSION_TTL = 1800; // 30 minutes

export async function getSession(chatId: number): Promise<BotSession | null> {
  const key = `${SESSION_PREFIX}:${chatId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BotSession;
  } catch {
    return null;
  }
}

export async function setSession(chatId: number, session: BotSession): Promise<void> {
  const key = `${SESSION_PREFIX}:${chatId}`;
  // Reset TTL on every update — 30 min from last interaction
  await redis.setex(key, SESSION_TTL, JSON.stringify(session));
}

export async function clearSession(chatId: number): Promise<void> {
  await redis.del(`${SESSION_PREFIX}:${chatId}`);
}

// ---- Command registration ------------------------------------------

bot.command('start', startCommand);
bot.command('post', startCommand); // /post triggers same flow as /start
bot.command('status', statusCommand);
bot.command('accounts', accountsCommand);
bot.command('help', helpCommand);

// All callback queries (inline keyboard button presses) go through the conversation handler
bot.on('callback_query:data', handleCallbackQuery);

// Free text messages during an active conversation
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = await getSession(chatId);

  if (!session) {
    // No active session — session expired or user hasn't started
    await ctx.reply(
      "Your session expired 😴 Send /post to start a new one."
    );
    return;
  }

  // Only expect free text during the IDEA step
  if (session.step === 'IDEA') {
    await handlePublishConversation(ctx, session);
  } else {
    await ctx.reply(
      "I didn't understand that. Please use the buttons above, or send /post to start over."
    );
  }
});

// Global error handler for the bot
bot.catch((err) => {
  logger.error('[Bot] Unhandled error', { error: err.message });
});

logger.info('[Bot] Grammy bot configured');

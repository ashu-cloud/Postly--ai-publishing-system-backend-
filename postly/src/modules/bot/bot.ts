
import { Bot, InlineKeyboard } from 'grammy';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { handlePublishConversation, handleCallbackQuery } from './conversations/publish.conversation';
import { startCommand } from './commands/start.command';
import { statusCommand } from './commands/status.command';
import { accountsCommand } from './commands/accounts.command';
import { helpCommand } from './commands/help.command';
import { getSession } from './session.store';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

bot.command('start', startCommand);
bot.command('post', startCommand); // /post triggers same flow as /start
bot.command('status', statusCommand);
bot.command('accounts', accountsCommand);
bot.command('help', helpCommand);

bot.on('callback_query:data', handleCallbackQuery);

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const username = ctx.from?.username || 'unknown';
  logger.info(`[Bot] Message received from @${username} (${chatId}): ${ctx.message.text}`);
  
  const session = await getSession(chatId);

  if (!session) {

    await ctx.reply(
      "Your session expired 😴 Send /post to start a new one."
    );
    return;
  }

  if (session.step === 'IDEA') {
    await handlePublishConversation(ctx, session);
  } else {
    await ctx.reply(
      "I didn't understand that. Please use the buttons above, or send /post to start over."
    );
  }
});

bot.catch((err) => {
  logger.error('[Bot] Unhandled error', { error: err.message });
});

logger.info('[Bot] Grammy bot configured');

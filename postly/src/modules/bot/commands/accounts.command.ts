
import { Context } from 'grammy';
import { prisma } from '../../../config/database';

const platformEmoji: Record<string, string> = {
  TWITTER: '🐦',
  LINKEDIN: '💼',
  INSTAGRAM: '📸',
  THREADS: '🧵',
};

export async function accountsCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;

  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    include: {
      socialAccounts: {
        select: { platform: true, handle: true, connectedAt: true },
      },
    },
  });

  if (!user) {
    await ctx.reply(
      "You haven't linked your Postly account. Visit the web app and link your Telegram in Profile settings."
    );
    return;
  }

  if (user.socialAccounts.length === 0) {
    await ctx.reply(
      "No social accounts connected yet. Visit the Postly web app to connect your accounts."
    );
    return;
  }

  const lines = ['🔗 *Connected Social Accounts:*\n'];
  for (const account of user.socialAccounts) {
    const emoji = platformEmoji[account.platform] ?? '📱';
    lines.push(`${emoji} ${account.platform} — @${account.handle}`);
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

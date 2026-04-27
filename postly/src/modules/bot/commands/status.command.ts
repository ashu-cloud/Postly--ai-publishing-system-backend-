/**
 * src/modules/bot/commands/status.command.ts
 *
 * /status — shows last 5 posts with per-platform statuses.
 */

import { Context } from 'grammy';
import { prisma } from '../../../config/database';

const statusEmoji: Record<string, string> = {
  PUBLISHED: '✅',
  FAILED: '❌',
  QUEUED: '⏳',
  PROCESSING: '🔄',
  CANCELLED: '🚫',
};

export async function statusCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;

  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
  });

  if (!user) {
    await ctx.reply(
      "You haven't linked your Postly account. Visit the web app and link your Telegram in Profile settings."
    );
    return;
  }

  const posts = await prisma.post.findMany({
    where: { userId: user.id },
    include: { platformPosts: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (posts.length === 0) {
    await ctx.reply("You haven't published any posts yet. Send /post to get started!");
    return;
  }

  const lines: string[] = ['📊 *Your last 5 posts:*\n'];

  for (const post of posts) {
    const date = post.createdAt.toLocaleDateString();
    lines.push(`📝 *${post.postType}* — ${date}`);
    lines.push(`Idea: "${post.idea.slice(0, 60)}${post.idea.length > 60 ? '...' : ''}"`);

    for (const pp of post.platformPosts) {
      const emoji = statusEmoji[pp.status] ?? '❓';
      lines.push(`  ${emoji} ${pp.platform}`);
    }
    lines.push('');
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}


import { Context } from 'grammy';

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    `📖 *Postly Bot Commands:*

/post — Create and publish a new post
/status — Check status of your last 5 posts
/accounts — View connected social accounts
/help — Show this message

💡 *Tip:* Your session expires after 30 minutes of inactivity.

🔗 Need to connect your account? Visit the Postly web app and link your Telegram in Profile settings.`,
    { parse_mode: 'Markdown' }
  );
}

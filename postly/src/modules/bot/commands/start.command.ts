
import { Context } from 'grammy';
import { startPublishFlow } from '../conversations/publish.conversation';

export async function startCommand(ctx: Context): Promise<void> {
  await startPublishFlow(ctx);
}


import { prisma } from '../config/database';
import { queuePublishingJobs } from './queue';
import { PostStatus } from '@prisma/client';
import { logger } from '../config/logger';

export function startScheduler(): void {
  const INTERVAL_MS = 60 * 1000; // Check every minute

  setInterval(async () => {
    try {
      // Find all SCHEDULED posts whose publishAt has passed
      const duePosts = await prisma.post.findMany({
        where: {
          status: PostStatus.SCHEDULED,
          publishAt: { lte: new Date() },
        },
        include: { platformPosts: true },
      });

      for (const post of duePosts) {
        logger.info(`[Scheduler] Dispatching scheduled post ${post.id}`);
        // Update status to QUEUED before adding to queue
        await prisma.post.update({
          where: { id: post.id },
          data: { status: PostStatus.QUEUED },
        });
        await queuePublishingJobs(post, post.platformPosts);
      }

      if (duePosts.length > 0) {
        logger.info(`[Scheduler] Dispatched ${duePosts.length} scheduled posts`);
      }
    } catch (err) {
      logger.error('[Scheduler] Error during scheduled post dispatch', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, INTERVAL_MS);

  logger.info('[Scheduler] Started — checking every 60s for scheduled posts');
}

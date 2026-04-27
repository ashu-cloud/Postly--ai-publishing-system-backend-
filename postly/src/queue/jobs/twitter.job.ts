/**
 * src/queue/jobs/twitter.job.ts
 * Job data type and processing for Twitter publishing.
 */

import { Job } from 'bullmq';
import { prisma } from '../../config/database';
import { publishToTwitter } from '../../services/platforms/twitter.service';
import { JobStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import type { PublishJobData } from '../../types';

/**
 * Processes a Twitter publishing job.
 * Called by the worker — returns void on success, throws on failure.
 */
export async function processTwitterJob(job: Job<PublishJobData>): Promise<void> {
  const { platformPostId, userId, content } = job.data;

  const platformPost = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    select: { status: true },
  });

  if (!platformPost) {
    throw new Error(`Platform post not found: ${platformPostId}`);
  }

  if (platformPost.status === JobStatus.CANCELLED || platformPost.status === JobStatus.PUBLISHED) {
    logger.info(`[Twitter] Skipping job for platformPostId=${platformPostId} with status=${platformPost.status}`);
    return;
  }

  // Mark as PROCESSING so dashboard shows live status
  await prisma.platformPost.update({
    where: { id: platformPostId },
    data: { status: JobStatus.PROCESSING, attempts: { increment: 1 } },
  });

  // Fetch user's connected Twitter account tokens (if any)
  const socialAccount = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId, platform: 'TWITTER' } },
  });

  const result = await publishToTwitter({
    content,
    userId,
    accessTokenEnc: socialAccount?.accessTokenEnc,
  });

  if (result.success) {
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: {
        status: JobStatus.PUBLISHED,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });
    logger.info(`[Twitter] Published — platformPostId: ${platformPostId}`);
  } else {
    throw new Error(result.error ?? 'Twitter publishing failed');
  }
}

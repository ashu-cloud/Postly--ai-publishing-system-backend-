/**
 * src/queue/jobs/linkedin.job.ts
 */

import { Job } from 'bullmq';
import { prisma } from '../../config/database';
import { publishToLinkedIn } from '../../services/platforms/linkedin.service';
import { JobStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import type { PublishJobData } from '../../types';

export async function processLinkedInJob(job: Job<PublishJobData>): Promise<void> {
  const { platformPostId, userId, content } = job.data;

  const platformPost = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    select: { status: true },
  });

  if (!platformPost) {
    throw new Error(`Platform post not found: ${platformPostId}`);
  }

  if (platformPost.status === JobStatus.CANCELLED || platformPost.status === JobStatus.PUBLISHED) {
    logger.info(`[LinkedIn] Skipping job for platformPostId=${platformPostId} with status=${platformPost.status}`);
    return;
  }

  await prisma.platformPost.update({
    where: { id: platformPostId },
    data: { status: JobStatus.PROCESSING, attempts: { increment: 1 } },
  });

  const socialAccount = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId, platform: 'LINKEDIN' } },
  });

  const result = await publishToLinkedIn({
    content,
    userId,
    accessTokenEnc: socialAccount?.accessTokenEnc,
  });

  if (result.success) {
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { status: JobStatus.PUBLISHED, publishedAt: new Date(), errorMessage: null },
    });
    logger.info(`[LinkedIn] Published — platformPostId: ${platformPostId}`);
  } else {
    throw new Error(result.error ?? 'LinkedIn publishing failed');
  }
}

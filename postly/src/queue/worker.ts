
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { processTwitterJob } from './jobs/twitter.job';
import { processLinkedInJob } from './jobs/linkedin.job';
import { processInstagramJob } from './jobs/instagram.job';
import { processThreadsJob } from './jobs/threads.job';
import { POSTLY_RETRY_BACKOFF_TYPE } from './queue';
import { prisma } from '../config/database';
import { JobStatus, PostStatus } from '@prisma/client';
import { logger } from '../config/logger';
import type { PublishJobData } from '../types';

/**
 * Recomputes the parent Post's aggregate status from all PlatformPost statuses.
 * Called after every job completion or failure.
 */
async function recomputePostStatus(postId: string): Promise<void> {
  const platformPosts = await prisma.platformPost.findMany({
    where: { postId },
    select: { status: true },
  });

  const statuses = platformPosts.map((p) => p.status);
  const allPublished = statuses.every((s) => s === JobStatus.PUBLISHED);
  const allFailed = statuses.every((s) => s === JobStatus.FAILED);
  const allDone = statuses.every(
    (s) => s === JobStatus.PUBLISHED || s === JobStatus.FAILED || s === JobStatus.CANCELLED
  );

  let postStatus: PostStatus;
  if (allPublished) {
    postStatus = PostStatus.PUBLISHED;
  } else if (allFailed) {
    postStatus = PostStatus.FAILED;
  } else if (allDone) {
    postStatus = PostStatus.PARTIAL; // mix of PUBLISHED and FAILED
  } else {
    postStatus = PostStatus.PROCESSING; // still some jobs running
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: postStatus },
  });
}

/** Creates a worker with error handling and status recomputation */
function createWorker(
  queueName: string,
  processor: (job: Job<PublishJobData>) => Promise<void>
): Worker<PublishJobData> {
  const worker = new Worker<PublishJobData>(
    queueName,
    async (job) => {
      try {
        await processor(job);
        await recomputePostStatus(job.data.postId);
      } catch (err) {
        // Re-throw so BullMQ knows the job failed and triggers retry/backoff
        throw err;
      }
    },
    {
      connection: createRedisConnection(),
      settings: {
        backoffStrategy: (attemptsMade, type) => {
          if (type !== POSTLY_RETRY_BACKOFF_TYPE) return 0;

          // Attempt 1: immediate (no delay)
          // Attempt 2: +5 seconds
          // Attempt 3: +25 seconds
          if (attemptsMade <= 2) return 5000;
          if (attemptsMade === 3) return 25000;
          return 25000;
        },
      },
    }
  );

  // After all retry attempts exhausted — mark platform_post as FAILED with reason
  worker.on('failed', async (job, err) => {
    if (!job) return;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);
    if (isLastAttempt) {
      logger.error(`[Worker:${queueName}] Job permanently failed`, {
        platformPostId: job.data.platformPostId,
        error: err.message,
      });
      await prisma.platformPost.update({
        where: { id: job.data.platformPostId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: err.message.slice(0, 1000), // truncate to fit DB column
        },
      });
      await recomputePostStatus(job.data.postId);
    }
  });

  worker.on('error', (err) => {
    logger.error(`[Worker:${queueName}] Worker error`, { error: err.message });
  });

  logger.info(`[Worker] ${queueName} worker started`);
  return worker;
}

export const twitterWorker = createWorker('twitter-publishing', processTwitterJob);
export const linkedinWorker = createWorker('linkedin-publishing', processLinkedInJob);
export const instagramWorker = createWorker('instagram-publishing', processInstagramJob);
export const threadsWorker = createWorker('threads-publishing', processThreadsJob);

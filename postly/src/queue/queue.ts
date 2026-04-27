/**
 * src/queue/queue.ts
 *
 * BullMQ queue definitions — one queue per platform.
 *
 * Why one queue per platform (not one shared queue):
 *   1. Independent scaling — we can add more Twitter workers without affecting LinkedIn
 *   2. Platform-specific rate limiting — Twitter API has different limits than LinkedIn
 *   3. Isolated failure domains — a LinkedIn outage doesn't block Twitter jobs
 *   4. Easier monitoring — queue depth per platform is a meaningful metric
 */

import { JobsOptions, Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import type { PublishJobData } from '../types';
import { Platform, PlatformPost, Post } from '@prisma/client';

interface RemovableJob {
  id?: string;
  remove(): Promise<void>;
}

interface QueueAdapter {
  add(name: string, data: PublishJobData, opts?: JobsOptions): Promise<RemovableJob>;
  getJob(jobId: string): Promise<RemovableJob | undefined>;
}

class InMemoryJob implements RemovableJob {
  constructor(
    public id: string,
    private readonly jobs: Map<string, InMemoryJob>
  ) {}

  async remove(): Promise<void> {
    this.jobs.delete(this.id);
  }
}

class InMemoryQueue implements QueueAdapter {
  private readonly jobs = new Map<string, InMemoryJob>();

  constructor(private readonly queueName: string) {}

  async add(
    _name: string,
    _data: PublishJobData,
    opts?: JobsOptions
  ): Promise<RemovableJob> {
    const customJobId = typeof opts?.jobId === 'string' ? opts.jobId : undefined;
    const jobId = customJobId ?? `${this.queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const existing = this.jobs.get(jobId);
    if (existing) return existing;

    const job = new InMemoryJob(jobId, this.jobs);
    this.jobs.set(jobId, job);
    return job;
  }

  async getJob(jobId: string): Promise<RemovableJob | undefined> {
    return this.jobs.get(jobId);
  }
}

export const POSTLY_RETRY_BACKOFF_TYPE = 'postly-exponential';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: POSTLY_RETRY_BACKOFF_TYPE,
  },
  removeOnComplete: false,
  removeOnFail: false,
};

function createPlatformQueue(queueName: string): QueueAdapter {
  if (process.env.NODE_ENV === 'test') {
    // Tests should not require a live Redis instance.
    return new InMemoryQueue(queueName);
  }

  return new Queue<PublishJobData>(queueName, {
    connection: createRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

// Each queue gets its own Redis connection — BullMQ requires this
// because it uses blocking commands (BLPOP) that monopolise a connection
export const twitterQueue = createPlatformQueue('twitter-publishing');
export const linkedinQueue = createPlatformQueue('linkedin-publishing');
export const instagramQueue = createPlatformQueue('instagram-publishing');
export const threadsQueue = createPlatformQueue('threads-publishing');

export function getQueueForPlatform(platform: Platform): QueueAdapter {
  switch (platform) {
    case Platform.TWITTER:   return twitterQueue;
    case Platform.LINKEDIN:  return linkedinQueue;
    case Platform.INSTAGRAM: return instagramQueue;
    case Platform.THREADS:   return threadsQueue;
    default:
      throw new Error(`No queue defined for platform: ${platform}`);
  }
}

/**
 * Queues one BullMQ job per platform post.
 * @param delayMs - optional delay in ms for scheduled posts
 */
export async function queuePublishingJobs(
  post: Post,
  platformPosts: PlatformPost[],
  delayMs = 0
): Promise<void> {
  for (const platformPost of platformPosts) {
    const queue = getQueueForPlatform(platformPost.platform);
    const jobOptions = {
      jobId: platformPost.id,
      ...(delayMs > 0 ? { delay: delayMs } : {}),
    };

    try {
      await queue.add(
        'publish',
        {
          platformPostId: platformPost.id,
          postId: post.id,
          userId: post.userId,
          platform: platformPost.platform,
          content: platformPost.content,
        },
        jobOptions
      );
    } catch (err) {
      // Idempotency guard: scheduler and delayed jobs may race to enqueue the same job ID.
      if (err instanceof Error && /jobid|exists/i.test(err.message)) {
        continue;
      }
      throw err;
    }
  }
}

export async function removeQueuedPublishingJobs(platformPosts: PlatformPost[]): Promise<void> {
  for (const platformPost of platformPosts) {
    const queue = getQueueForPlatform(platformPost.platform);
    const job = await queue.getJob(platformPost.id);
    if (!job) continue;
    await job.remove();
  }
}

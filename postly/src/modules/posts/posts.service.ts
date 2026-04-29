/**
 * src/modules/posts/posts.service.ts
 *
 * Post publishing, scheduling, retrieval, retry, and cancellation.
 */

import { prisma } from '../../config/database';
import { generateContent } from '../../services/ai/openrouter.service';
import { queuePublishingJobs, removeQueuedPublishingJobs } from '../../queue/queue';
import { PostStatus, JobStatus, Platform } from '@prisma/client';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../utils/errors';
import { buildPaginationMeta, parsePagination, getSkip } from '../../utils/pagination';
import type { PublishInput, ScheduleInput, ListPostsQuery } from './posts.schema';

export async function publishPost(userId: string, input: PublishInput) {
  // 1. Generate AI content
  const aiResult = await generateContent({
    ...input,
    userId,
  });

  // 2. Create parent Post record
  const post = await prisma.post.create({
    data: {
      userId,
      idea: input.idea,
      postType: input.postType,
      tone: input.tone,
      language: input.language,
      modelUsed: input.model === 'openai' ? 'OPENAI' : 'ANTHROPIC',
      status: PostStatus.QUEUED,
    },
  });

  // 3. Create PlatformPost record for each requested platform
  const platformPosts = await Promise.all(
    input.platforms.map((platform) => {
      const generated = aiResult.generated[platform.toLowerCase() as keyof typeof aiResult.generated];
      const content = generated?.content ?? '';

      return prisma.platformPost.create({
        data: {
          postId: post.id,
          platform,
          content,
          status: JobStatus.QUEUED,
        },
      });
    })
  );

  // 4. Queue one BullMQ job per platform
  await queuePublishingJobs(post, platformPosts);

  return {
    post: await prisma.post.findUnique({
      where: { id: post.id },
      include: { platformPosts: true },
    }),
    aiGenerated: aiResult.generated,
  };
}

export async function schedulePost(userId: string, input: ScheduleInput) {
  const aiResult = await generateContent({ ...input, userId });

  const publishAt = new Date(input.publishAt);
  const delayMs = publishAt.getTime() - Date.now();

  const post = await prisma.post.create({
    data: {
      userId,
      idea: input.idea,
      postType: input.postType,
      tone: input.tone,
      language: input.language,
      modelUsed: input.model === 'openai' ? 'OPENAI' : 'ANTHROPIC',
      status: PostStatus.SCHEDULED,
      publishAt,
    },
  });

  const platformPosts = await Promise.all(
    input.platforms.map((platform) => {
      const generated = aiResult.generated[platform.toLowerCase() as keyof typeof aiResult.generated];
      return prisma.platformPost.create({
        data: { postId: post.id, platform, content: generated?.content ?? '', status: JobStatus.QUEUED },
      });
    })
  );

  // Queue with delay — BullMQ will hold the job until the delay elapses
  await queuePublishingJobs(post, platformPosts, delayMs);

  return prisma.post.findUnique({ where: { id: post.id }, include: { platformPosts: true } });
}

export async function listPosts(userId: string, query: ListPostsQuery) {
  const { page, limit } = parsePagination(query as Record<string, unknown>);

  const where = {
    userId,
    ...(query.status ? { status: query.status as PostStatus } : {}),
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        }
      : {}),
    ...(query.platform
      ? { platformPosts: { some: { platform: query.platform as Platform } } }
      : {}),
    deletedAt: null, // Filter out soft-deleted posts
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: { platformPosts: true },
      orderBy: { createdAt: 'desc' },
      skip: getSkip({ page, limit }),
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, meta: buildPaginationMeta(total, { page, limit }) };
}

export async function getPost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    include: { platformPosts: true },
  });
  if (!post) throw new NotFoundError('Post');
  if (post.userId !== userId) throw new ForbiddenError('You do not own this post');
  return post;
}

export async function retryPost(userId: string, postId: string) {
  const post = await getPost(userId, postId);

  const failedPlatformPosts = post.platformPosts.filter(
    (pp) => pp.status === JobStatus.FAILED
  );

  if (failedPlatformPosts.length === 0) {
    throw new UnprocessableError('No failed platform posts to retry');
  }

  // Reset failed platform posts and re-queue
  await Promise.all(
    failedPlatformPosts.map((pp) =>
      prisma.platformPost.update({
        where: { id: pp.id },
        data: { status: JobStatus.QUEUED, attempts: 0, errorMessage: null },
      })
    )
  );

  await prisma.post.update({
    where: { id: postId },
    data: { status: PostStatus.QUEUED },
  });

  await queuePublishingJobs(post, failedPlatformPosts);

  return prisma.post.findUnique({ where: { id: postId }, include: { platformPosts: true } });
}

export async function deletePost(userId: string, postId: string) {
  const post = await getPost(userId, postId);

  // If the post is scheduled, try to cancel it in the queue
  if (post.status === PostStatus.SCHEDULED) {
    await removeQueuedPublishingJobs(post.platformPosts);
    await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.CANCELLED },
    });
    await prisma.platformPost.updateMany({
      where: { postId },
      data: { status: JobStatus.CANCELLED },
    });
  }

  // Perform the soft delete
  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  return { message: 'Post deleted successfully' };
}

export async function restorePost(userId: string, postId: string) {
  // Use findUnique without deletedAt: null to find the soft-deleted post
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.userId !== userId) throw new NotFoundError('Post');

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: null },
  });

  return { message: 'Post restored successfully' };
}

export async function getPostAnalytics(userId: string, postId: string) {
  const post = await getPost(userId, postId);

  // Simulate analytics fetching from platforms
  const analytics = post.platformPosts.map((pp) => {
    if (pp.status !== JobStatus.PUBLISHED) {
      return { platform: pp.platform, status: pp.status, stats: null };
    }
    
    // Generate pseudo-random realistic stats based on post ID and platform
    const seed = pp.id.charCodeAt(0) + pp.id.charCodeAt(pp.id.length - 1);
    return {
      platform: pp.platform,
      status: pp.status,
      stats: {
        likes: (seed * 13) % 500,
        shares: (seed * 7) % 100,
        views: (seed * 113) % 10000,
      }
    };
  });

  return { postId: post.id, analytics };
}

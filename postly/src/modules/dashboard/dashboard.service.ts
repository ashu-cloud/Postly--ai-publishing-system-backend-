
import { prisma } from '../../config/database';
import { PostStatus, JobStatus, Platform } from '@prisma/client';

export async function getDashboardStats(userId: string) {
  // Run all queries in parallel — independent DB operations
  const [
    totalPosts,
    platformPostCounts,
    postsByStatus,
    recentActivity,
  ] = await Promise.all([
    prisma.post.count({ where: { userId } }),

    // Count PlatformPosts by platform for this user's posts
    prisma.platformPost.groupBy({
      by: ['platform'],
      where: { post: { userId } },
      _count: { platform: true },
    }),

    // Count Posts by status
    prisma.post.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    }),

    // Last 10 posts with platform details
    prisma.post.findMany({
      where: { userId },
      include: { platformPosts: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Compute success rate: published / (published + failed) * 100
  const publishedCount = postsByStatus.find((s) => s.status === PostStatus.PUBLISHED)?._count.status ?? 0;
  const failedCount = postsByStatus.find((s) => s.status === PostStatus.FAILED)?._count.status ?? 0;
  const successRate =
    publishedCount + failedCount > 0
      ? Math.round((publishedCount / (publishedCount + failedCount)) * 100)
      : 0;

  // Shape platform counts into a flat object
  const postsPerPlatform = {
    twitter: 0,
    linkedin: 0,
    instagram: 0,
    threads: 0,
  };
  for (const row of platformPostCounts) {
    postsPerPlatform[row.platform.toLowerCase() as keyof typeof postsPerPlatform] = row._count.platform;
  }

  // Shape status counts into a flat object
  const postsByStatusFlat = {
    published: 0,
    failed: 0,
    queued: 0,
    scheduled: 0,
    processing: 0,
    partial: 0,
    cancelled: 0,
  };
  for (const row of postsByStatus) {
    postsByStatusFlat[row.status.toLowerCase() as keyof typeof postsByStatusFlat] = row._count.status;
  }

  return {
    totalPosts,
    successRate,
    postsPerPlatform,
    postsByStatus: postsByStatusFlat,
    recentActivity,
  };
}

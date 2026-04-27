/**
 * src/modules/posts/posts.schema.ts
 */

import { z } from 'zod';
import { Platform, PostType, Tone } from '@prisma/client';

const basePublishSchema = z.object({
  idea: z.string().min(1).max(500),
  postType: z.nativeEnum(PostType),
  platforms: z.array(z.nativeEnum(Platform)).min(1).max(4),
  tone: z.nativeEnum(Tone),
  language: z.string().length(2).default('en'),
  model: z.enum(['openai', 'anthropic']),
});

export const publishSchema = basePublishSchema;

export const scheduleSchema = basePublishSchema.extend({
  publishAt: z
    .string()
    .datetime({ message: 'publishAt must be a valid ISO 8601 datetime' })
    .refine(
      (val) => new Date(val) > new Date(),
      { message: 'publishAt must be in the future' }
    ),
});

export const retrySchema = z.object({
  platformPostId: z.string().cuid(),
});

export const listPostsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  platform: z.nativeEnum(Platform).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type PublishInput = z.infer<typeof publishSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

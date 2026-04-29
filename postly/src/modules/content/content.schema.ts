
import { z } from 'zod';
import { Platform, PostType, Tone } from '@prisma/client';

export const generateContentSchema = z.object({
  idea: z
    .string()
    .min(1, 'Idea is required')
    .max(500, 'Idea must not exceed 500 characters'),
  postType: z.nativeEnum(PostType),
  platforms: z
    .array(z.nativeEnum(Platform))
    .min(1, 'At least one platform must be selected')
    .max(4, 'Maximum 4 platforms'),
  tone: z.nativeEnum(Tone),
  language: z.string().length(2, 'Language must be a 2-char ISO code').default('en'),
  model: z.enum(['openai', 'anthropic']),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;

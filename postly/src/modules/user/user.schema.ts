/**
 * src/modules/user/user.schema.ts
 */

import { z } from 'zod';
import { Platform, Tone } from '@prisma/client';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  defaultTone: z.nativeEnum(Tone).optional(),
  defaultLanguage: z.string().length(2, 'Language must be a 2-char ISO code').optional(),
});

export const addSocialAccountSchema = z.object({
  platform: z.nativeEnum(Platform),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  handle: z.string().min(1, 'Handle is required'),
});

export const updateAiKeysSchema = z.object({
  openaiKey: z.string().min(1).optional(),
  anthropicKey: z.string().min(1).optional(),
}).refine(
  (data) => data.openaiKey !== undefined || data.anthropicKey !== undefined,
  { message: 'At least one key (openaiKey or anthropicKey) must be provided' }
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddSocialAccountInput = z.infer<typeof addSocialAccountSchema>;
export type UpdateAiKeysInput = z.infer<typeof updateAiKeysSchema>;

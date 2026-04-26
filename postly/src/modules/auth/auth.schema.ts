/**
 * src/modules/auth/auth.schema.ts
 *
 * Zod schemas for all auth endpoint request bodies.
 * Validation happens in the middleware layer before reaching the controller.
 */

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refresh_token: z.string().uuid('refresh_token must be a valid UUID'),
});

export const logoutSchema = z.object({
  refresh_token: z.string().uuid('refresh_token must be a valid UUID'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

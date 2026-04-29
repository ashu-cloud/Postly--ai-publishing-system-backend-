
import { Request } from 'express';
import { Platform, PostType, Tone, AiModel } from '@prisma/client';

// ---- Auth --------------------------------------------------------

/** Attached to req by auth.middleware after JWT verification */
export interface AuthUser {
  id: string;
  email: string;
}

/** Express Request augmented with authenticated user */
export interface AuthRequest extends Request {
  user: AuthUser;
}

// ---- Pagination --------------------------------------------------

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// ---- AI / Content ------------------------------------------------

export interface PlatformContent {
  content: string;
  charCount?: number;
  hashtags?: string[];
}

export interface GeneratedContent {
  twitter?: PlatformContent;
  linkedin?: PlatformContent;
  instagram?: PlatformContent;
  threads?: PlatformContent;
}

export interface GenerateContentParams {
  idea: string;
  postType: PostType;
  platforms: Platform[];
  tone: Tone;
  language: string;
  model: 'openai' | 'anthropic';
  userId: string;
}

// ---- Queue / Jobs ------------------------------------------------

export interface PublishJobData {
  platformPostId: string;
  postId: string;
  userId: string;
  platform: Platform;
  content: string;
}

// ---- Telegram Bot ------------------------------------------------

export type BotStep =
  | 'POST_TYPE'
  | 'PLATFORMS'
  | 'TONE'
  | 'MODEL'
  | 'IDEA'
  | 'CONFIRM';

export interface BotSession {
  step: BotStep;
  postType?: string;
  platforms?: string[];
  tone?: string;
  model?: string;
  idea?: string;
  generatedContent?: GeneratedContent;
  userId?: string; // linked Postly user ID
}

// ---- Platform Services -------------------------------------------

export interface PlatformPublishResult {
  success: boolean;
  postId?: string;       // ID returned by the platform API
  error?: string;
  demoMode?: boolean;    // true when simulating (no real API call)
}

// ---- Response Envelope -------------------------------------------

export interface ApiResponse<T = unknown> {
  data: T | null;
  meta: PaginationMeta | null;
  error: { message: string; code: string } | null;
}

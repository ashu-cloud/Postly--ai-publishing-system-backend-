/**
 * src/services/ai/ai.types.ts
 *
 * Types for the AI content generation service.
 */

import { Platform, PostType, Tone } from '@prisma/client';

export interface GenerateParams {
  idea: string;
  postType: PostType;
  platforms: Platform[];
  tone: Tone;
  language: string;
  model: 'openai' | 'anthropic';
  userId: string;
}

export interface PlatformContentRaw {
  content: string;
  hashtags?: string[];
}

export interface AIRawResponse {
  twitter?: PlatformContentRaw;
  linkedin?: PlatformContentRaw;
  instagram?: PlatformContentRaw;
  threads?: PlatformContentRaw;
}

export interface ProcessedPlatformContent {
  content: string;
  charCount: number;
  hashtags: string[];
}

export interface AIResponse {
  generated: {
    twitter?: ProcessedPlatformContent;
    linkedin?: ProcessedPlatformContent & { charCount: number };
    instagram?: { content: string; hashtags: string[] };
    threads?: { content: string; charCount: number };
  };
  modelUsed: string;
  tokensUsed: number;
}

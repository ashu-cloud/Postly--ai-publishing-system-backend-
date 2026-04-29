
import OpenAI from 'openai';
import { prisma } from '../../config/database';
import { decrypt } from '../crypto.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { twitterPromptFragment } from '../../modules/content/prompts/twitter.prompt';
import { linkedinPromptFragment } from '../../modules/content/prompts/linkedin.prompt';
import { instagramPromptFragment } from '../../modules/content/prompts/instagram.prompt';
import { threadsPromptFragment } from '../../modules/content/prompts/threads.prompt';
import type { GenerateParams, AIResponse, AIRawResponse } from './ai.types';
import { Platform } from '@prisma/client';

const openaiClient = new OpenAI({
  apiKey: env.OPENAI_KEY,
  baseURL: 'https://api.openai.com/v1',
});

const claudeClient = new OpenAI({
  apiKey: env.CLAUDE_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://postly.app',
    'X-Title': 'Postly Publishing Engine',
  },
});

function buildSystemPrompt(platforms: Platform[]): string {
  const platformsLower = platforms.map((p) => p.toLowerCase());
  
  const fragments: string[] = [
    'You are a professional social media content writer.',
    `Generate platform-specific content for: ${platformsLower.join(', ')}.`,
    '',
    'STRICT PLATFORM RULES — FOLLOW EXACTLY:',
  ];

  if (platformsLower.includes('twitter')) fragments.push(twitterPromptFragment);
  if (platformsLower.includes('linkedin')) fragments.push(linkedinPromptFragment);
  if (platformsLower.includes('instagram')) fragments.push(instagramPromptFragment);
  if (platformsLower.includes('threads')) fragments.push(threadsPromptFragment);

  fragments.push(`
RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure (no markdown, no code fences, no explanation):
{
  ${platformsLower.includes('twitter') ? '"twitter": { "content": "...", "hashtags": ["#tag1"] },' : ''}
  ${platformsLower.includes('linkedin') ? '"linkedin": { "content": "...", "hashtags": ["#tag1"] },' : ''}
  ${platformsLower.includes('instagram') ? '"instagram": { "content": "...", "hashtags": ["#tag1"] },' : ''}
  ${platformsLower.includes('threads') ? '"threads": { "content": "..." },' : ''}
}

Only include keys for the requested platforms. Content must be ready to post — no placeholders.`);

  return fragments.join('\n');
}

function buildUserPrompt(params: GenerateParams): string {
  return `Create ${params.postType.toLowerCase()} content with a ${params.tone.toLowerCase()} tone.
Language: ${params.language}
Core idea: ${params.idea}

Generate the content now.`;
}

function extractHashtags(content: string): string[] {
  const matches = content.match(/#\w+/g) ?? [];
  return [...new Set(matches)]; // deduplicate
}

function parseAndValidate(rawJson: string, platforms: Platform[]): AIRawResponse {

  const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  let parsed: AIRawResponse;
  try {
    parsed = JSON.parse(cleaned) as AIRawResponse;
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
  return parsed;
}

function processResponse(raw: AIRawResponse, platforms: Platform[]): AIResponse['generated'] {
  const result: AIResponse['generated'] = {};

  if (platforms.includes(Platform.TWITTER) && raw.twitter) {
    let content = raw.twitter.content ?? '';

    if (content.length > 280) {
      content = content.slice(0, 277) + '...';
      logger.warn('[AI] Twitter content truncated to 280 chars');
    }
    result.twitter = {
      content,
      charCount: content.length,
      hashtags: raw.twitter.hashtags ?? extractHashtags(content),
    };
  }

  if (platforms.includes(Platform.LINKEDIN) && raw.linkedin) {
    let content = raw.linkedin.content ?? '';
    if (content.length < 800) {
      logger.warn('[AI] LinkedIn content below 800-char minimum');
    }
    if (content.length > 1300) {
      content = content.slice(0, 1297) + '...';
      logger.warn('[AI] LinkedIn content truncated to 1300 chars');
    }
    result.linkedin = {
      content,
      charCount: content.length,
      hashtags: raw.linkedin.hashtags ?? extractHashtags(content),
    };
  }

  if (platforms.includes(Platform.INSTAGRAM) && raw.instagram) {
    const content = raw.instagram.content ?? '';
    result.instagram = {
      content,
      hashtags: raw.instagram.hashtags ?? extractHashtags(content),
    };
  }

  if (platforms.includes(Platform.THREADS) && raw.threads) {
    let content = raw.threads.content ?? '';
    if (content.length > 500) {
      content = content.slice(0, 497) + '...';
      logger.warn('[AI] Threads content truncated to 500 chars');
    }
    result.threads = {
      content,
      charCount: content.length,
    };
  }

  return result;
}

export async function generateContent(params: GenerateParams): Promise<AIResponse> {

  let client = params.model === 'openai' ? openaiClient : claudeClient;
  const modelName = params.model === 'openai' ? 'gpt-4o' : 'anthropic/claude-sonnet-4-6';

  const userKeys = await prisma.aiKeys.findUnique({ where: { userId: params.userId } });
  if (userKeys) {
    if (params.model === 'openai' && userKeys.openaiKeyEnc) {

      client = new OpenAI({
        apiKey: decrypt(userKeys.openaiKeyEnc),
        baseURL: 'https://api.openai.com/v1',
      });
    } else if (params.model === 'anthropic' && userKeys.anthropicKeyEnc) {
      client = new OpenAI({
        apiKey: decrypt(userKeys.anthropicKeyEnc),
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
  }

  logger.info(`[AI] Generating content via ${params.model} (${modelName})`, {
    platforms: params.platforms,
    postType: params.postType,
  });

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: buildSystemPrompt(params.platforms) },
      { role: 'user', content: buildUserPrompt(params) },
    ],
    temperature: 0.7,
    max_tokens: 700,
  });

  const rawText = response.choices[0]?.message?.content ?? '';
  const rawParsed = parseAndValidate(rawText, params.platforms);
  const generated = processResponse(rawParsed, params.platforms);

  return {
    generated,
    modelUsed: modelName,
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}

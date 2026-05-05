import { redis } from '../../config/redis';
import type { BotSession } from '../../types';

const SESSION_PREFIX = 'bot:session';
const SESSION_TTL = 1800; // 30 minutes

function getSessionKey(chatId: number): string {
  return `${SESSION_PREFIX}:${chatId}`;
}

export async function getSession(chatId: number): Promise<BotSession | null> {
  const raw = await redis.get(getSessionKey(chatId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BotSession;
  } catch {
    return null;
  }
}

export async function setSession(chatId: number, session: BotSession): Promise<void> {
  await redis.setex(getSessionKey(chatId), SESSION_TTL, JSON.stringify(session));
}

export async function clearSession(chatId: number): Promise<void> {
  await redis.del(getSessionKey(chatId));
}
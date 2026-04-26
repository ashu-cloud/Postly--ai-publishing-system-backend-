/**
 * src/modules/auth/auth.service.ts
 *
 * All auth business logic lives here — controllers are thin wrappers.
 * Services interact with the DB and external systems (bcrypt, JWT, UUID).
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AuthError, ConflictError, NotFoundError } from '../../utils/errors';
import type { RegisterInput, LoginInput, RefreshInput } from './auth.schema';

// bcrypt cost factor 12 — OWASP recommendation.
// At this factor, hashing takes ~250ms on modern hardware — fast enough for UX,
// slow enough that brute-forcing 10^9 passwords would take decades.
const BCRYPT_ROUNDS = 12;

// ---- Token helpers -----------------------------------------------

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    }
  );
}

async function createRefreshToken(userId: string): Promise<string> {
  // Refresh token is a random UUID — not a JWT.
  // Random UUIDs can't be forged; DB lookup confirms validity + revocation status.
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}

// ---- Service methods ----------------------------------------------

export async function registerUser(input: RegisterInput) {
  // Check email uniqueness before hashing (saves CPU on duplicate attempts)
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
    select: { id: true, email: true, name: true }, // never return passwordHash
  });

  return { user };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Use the same timing path regardless of whether the user exists.
  // If user not found, run a dummy compare to prevent timing-based user enumeration.
  // Hash for a static dummy password at cost factor 12.
  const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO1u6kS1JrVN6a8GN28AL5soNqd7qV3Cy';
  const passwordMatch = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : await bcrypt.compare(input.password, DUMMY_HASH).then(() => false);

  if (!user || !passwordMatch) {
    // Same error message for wrong email AND wrong password — never reveal which
    throw new AuthError('Invalid credentials');
  }

  const access_token = generateAccessToken(user.id, user.email);
  const refresh_token = await createRefreshToken(user.id);

  return {
    access_token,
    refresh_token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function refreshTokens(input: RefreshInput) {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: input.refresh_token },
    include: { user: true },
  });

  // Check: exists, not revoked, not expired
  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    throw new AuthError('Invalid or expired refresh token');
  }

  // Token rotation: revoke old token, issue new one.
  // This means a stolen refresh token can only be used once — the next legitimate
  // use will fail (token already revoked) and the user knows to re-authenticate.
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  const access_token = generateAccessToken(storedToken.userId, storedToken.user.email);
  const refresh_token = await createRefreshToken(storedToken.userId);

  return { access_token, refresh_token };
}

export async function logoutUser(userId: string, refreshToken: string) {
  // Only revoke if the token belongs to this user — prevents cross-user revocation
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, userId, revoked: false },
    data: { revoked: true },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      defaultTone: true,
      defaultLanguage: true,
      telegramChatId: true,
      createdAt: true,
    },
  });

  if (!user) throw new NotFoundError('User');
  return user;
}


import { prisma } from '../../config/database';
import { encrypt } from '../../services/crypto.service';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import type { UpdateProfileInput, AddSocialAccountInput, UpdateAiKeysInput } from './user.schema';

export async function getProfile(userId: string) {
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
      updatedAt: true,
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      defaultTone: true,
      defaultLanguage: true,
      telegramChatId: true,
    },
  });
  return user;
}

export async function addSocialAccount(userId: string, input: AddSocialAccountInput) {
  const account = await prisma.socialAccount.create({
    data: {
      userId,
      platform: input.platform,
      // Encrypt before storing — tokens NEVER plaintext in DB
      accessTokenEnc: encrypt(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encrypt(input.refreshToken) : null,
      handle: input.handle,
    },
    select: {
      id: true,
      platform: true,
      handle: true,
      connectedAt: true,
      // Explicitly exclude accessTokenEnc and refreshTokenEnc
    },
  });
  return account;
}

export async function getSocialAccounts(userId: string) {
  return prisma.socialAccount.findMany({
    where: { userId },
    select: {
      id: true,
      platform: true,
      handle: true,
      connectedAt: true,
      // Encrypted token fields intentionally excluded from response
    },
    orderBy: { connectedAt: 'asc' },
  });
}

export async function deleteSocialAccount(userId: string, accountId: string) {
  // Verify ownership before deleting — prevents cross-user deletion
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new NotFoundError('Social account');
  if (account.userId !== userId) throw new ForbiddenError('You do not own this account');

  await prisma.socialAccount.delete({ where: { id: accountId } });
}

export async function updateAiKeys(userId: string, input: UpdateAiKeysInput) {
  // Upsert — create if not exists, update if exists
  const encryptedKeys: { openaiKeyEnc?: string; anthropicKeyEnc?: string } = {};
  if (input.openaiKey) encryptedKeys.openaiKeyEnc = encrypt(input.openaiKey);
  if (input.anthropicKey) encryptedKeys.anthropicKeyEnc = encrypt(input.anthropicKey);

  await prisma.aiKeys.upsert({
    where: { userId },
    create: { userId, ...encryptedKeys },
    update: encryptedKeys,
  });

  return { message: 'AI keys updated successfully' };
}

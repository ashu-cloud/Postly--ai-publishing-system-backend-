
import { decrypt } from '../crypto.service';
import { logger } from '../../config/logger';
import type { PlatformPublishResult } from '../../types';

interface InstagramPublishParams {
  content: string;
  userId: string;
  accessTokenEnc?: string;
}

export async function publishToInstagram(
  params: InstagramPublishParams
): Promise<PlatformPublishResult> {
  if (!params.accessTokenEnc) {
    logger.info(`[DEMO MODE] Would have posted to Instagram: "${params.content.slice(0, 50)}..."`);
    return { success: true, postId: `demo_instagram_${Date.now()}`, demoMode: true };
  }

  try {
    const accessToken = decrypt(params.accessTokenEnc);

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v18.0/me/media?caption=${encodeURIComponent(params.content)}&media_type=TEXT&access_token=${accessToken}`,
      { method: 'POST' }
    );

    if (!containerRes.ok) {
      const err = await containerRes.text();
      throw new Error(`Instagram container creation failed: ${err}`);
    }

    const containerData = await containerRes.json() as { id: string };

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/me/media_publish?creation_id=${containerData.id}&access_token=${accessToken}`,
      { method: 'POST' }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Instagram publish failed: ${err}`);
    }

    const publishData = await publishRes.json() as { id: string };
    return { success: true, postId: publishData.id };
  } catch (err) {
    logger.error('[Instagram] Publish failed', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

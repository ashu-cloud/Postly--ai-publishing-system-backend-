
import { decrypt } from '../crypto.service';
import { logger } from '../../config/logger';
import type { PlatformPublishResult } from '../../types';

interface ThreadsPublishParams {
  content: string;
  userId: string;
  accessTokenEnc?: string;
}

export async function publishToThreads(
  params: ThreadsPublishParams
): Promise<PlatformPublishResult> {
  if (!params.accessTokenEnc) {
    logger.info(`[DEMO MODE] Would have posted to Threads: "${params.content.slice(0, 50)}..."`);
    return { success: true, postId: `demo_threads_${Date.now()}`, demoMode: true };
  }

  try {
    const accessToken = decrypt(params.accessTokenEnc);

    // Step 1: Create threads container
    const containerRes = await fetch(
      `https://graph.threads.net/v1.0/me/threads`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: 'TEXT',
          text: params.content,
        }),
      }
    );

    if (!containerRes.ok) {
      const err = await containerRes.text();
      throw new Error(`Threads container creation failed: ${err}`);
    }

    const containerData = await containerRes.json() as { id: string };

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/me/threads_publish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id }),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Threads publish failed: ${err}`);
    }

    const publishData = await publishRes.json() as { id: string };
    return { success: true, postId: publishData.id };
  } catch (err) {
    logger.error('[Threads] Publish failed', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

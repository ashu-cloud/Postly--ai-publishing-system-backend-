/**
 * src/services/platforms/twitter.service.ts
 *
 * Twitter API v2 publishing service — scaffold + simulation pattern.
 *
 * If user has a connected Twitter account with tokens → real API call.
 * If no account connected → demo mode (logs what would have been posted).
 *
 * Real API endpoint: POST https://api.twitter.com/2/tweets
 * Auth: OAuth 2.0 Bearer token
 */

import { decrypt } from '../crypto.service';
import { logger } from '../../config/logger';
import type { PlatformPublishResult } from '../../types';

interface TwitterPublishParams {
  content: string;
  userId: string;
  accessTokenEnc?: string; // encrypted — must decrypt before use
}

export async function publishToTwitter(
  params: TwitterPublishParams
): Promise<PlatformPublishResult> {
  // Demo mode — no token available
  if (!params.accessTokenEnc) {
    logger.info(`[DEMO MODE] Would have posted to Twitter: "${params.content.slice(0, 50)}..."`);
    return {
      success: true,
      postId: `demo_twitter_${Date.now()}`,
      demoMode: true,
    };
  }

  // Real API call
  try {
    const accessToken = decrypt(params.accessTokenEnc);

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: params.content }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twitter API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as { data: { id: string } };
    return { success: true, postId: data.data.id };
  } catch (err) {
    logger.error('[Twitter] Publish failed', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

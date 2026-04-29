
import { decrypt } from '../crypto.service';
import { logger } from '../../config/logger';
import type { PlatformPublishResult } from '../../types';

interface LinkedInPublishParams {
  content: string;
  userId: string;
  accessTokenEnc?: string;
}

export async function publishToLinkedIn(
  params: LinkedInPublishParams
): Promise<PlatformPublishResult> {
  if (!params.accessTokenEnc) {
    logger.info(`[DEMO MODE] Would have posted to LinkedIn: "${params.content.slice(0, 50)}..."`);
    return { success: true, postId: `demo_linkedin_${Date.now()}`, demoMode: true };
  }

  try {
    const accessToken = decrypt(params.accessTokenEnc);

    // LinkedIn UGC Posts API — requires author URN from profile
    // In a full implementation, we'd store the author URN when connecting the account
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${params.userId}`, // simplified — real impl uses stored URN
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`LinkedIn API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as { id: string };
    return { success: true, postId: data.id };
  } catch (err) {
    logger.error('[LinkedIn] Publish failed', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

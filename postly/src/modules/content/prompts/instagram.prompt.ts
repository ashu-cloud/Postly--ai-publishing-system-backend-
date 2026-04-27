/**
 * src/modules/content/prompts/instagram.prompt.ts
 * Instagram-specific prompt fragment for the master system prompt.
 */
export const instagramPromptFragment = `
INSTAGRAM:
- Write an engaging caption (no strict character limit, but aim for 125-150 words)
- Include exactly 10-15 relevant hashtags placed at the end after two line breaks (\\n\\n)
- Use emojis naturally throughout the caption — they should enhance tone, not clutter
- Keep the caption conversational, relatable, and authentic
- Start with a strong first line that appears before the "More" cutoff (~90 chars)
- End the caption with a soft call to action (question, invitation to comment, "save this")
`;

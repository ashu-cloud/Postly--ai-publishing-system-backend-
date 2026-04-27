/**
 * src/modules/bot/conversations/publish.conversation.ts
 *
 * Full 6-step publish conversation state machine.
 * State persisted in Redis — survives process restarts, 30-min TTL.
 *
 * Steps: POST_TYPE → PLATFORMS → TONE → MODEL → IDEA → CONFIRM
 */

import { Context, InlineKeyboard } from 'grammy';
import { getSession, setSession, clearSession } from '../bot';
import { generateContent } from '../../../services/ai/openrouter.service';
import { publishPost } from '../../posts/posts.service';
import { prisma } from '../../../config/database';
import { logger } from '../../../config/logger';
import type { BotSession, GeneratedContent } from '../../../types';
import { PostType, Platform, Tone } from '@prisma/client';

// ---- Keyboards -------------------------------------------------------

function postTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📢 Announcement', 'pt:ANNOUNCEMENT').text('🧵 Thread', 'pt:THREAD').row()
    .text('📖 Story', 'pt:STORY').text('🎯 Promotional', 'pt:PROMOTIONAL').row()
    .text('🎓 Educational', 'pt:EDUCATIONAL').text('💭 Opinion', 'pt:OPINION');
}

function platformKeyboard(selected: string[]): InlineKeyboard {
  const mark = (p: string) => selected.includes(p) ? '✅ ' : '';
  return new InlineKeyboard()
    .text(`${mark('TWITTER')}🐦 Twitter/X`, 'pf:TWITTER')
    .text(`${mark('LINKEDIN')}💼 LinkedIn`, 'pf:LINKEDIN').row()
    .text(`${mark('INSTAGRAM')}📸 Instagram`, 'pf:INSTAGRAM')
    .text(`${mark('THREADS')}🧵 Threads`, 'pf:THREADS').row()
    .text('🌐 All Platforms', 'pf:ALL').row()
    .text('✅ Done', 'pf:DONE');
}

function toneKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Professional', 'tone:PROFESSIONAL').text('Casual', 'tone:CASUAL').row()
    .text('Witty', 'tone:WITTY').text('Authoritative', 'tone:AUTHORITATIVE').row()
    .text('Friendly', 'tone:FRIENDLY');
}

function modelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🤖 GPT-4o (OpenAI)', 'model:openai').row()
    .text('🧠 Claude Sonnet (Anthropic)', 'model:anthropic');
}

function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Post Now', 'confirm:post')
    .text('✏️ Edit Idea', 'confirm:edit')
    .text('❌ Cancel', 'confirm:cancel');
}

// ---- Content formatting ----------------------------------------------

function formatGeneratedContent(content: GeneratedContent, platforms: string[]): string {
  const lines: string[] = ['Here\'s your generated content:\n'];

  if (content.twitter && platforms.includes('TWITTER')) {
    lines.push(`🐦 *Twitter/X* (${content.twitter.charCount} chars):`);
    lines.push(`"${content.twitter.content}"\n`);
  }
  if (content.linkedin && platforms.includes('LINKEDIN')) {
    lines.push(`💼 *LinkedIn* (${content.linkedin.charCount} chars):`);
    // Truncate for Telegram display — full content stored in DB
    const preview = content.linkedin.content.slice(0, 300) + (content.linkedin.content.length > 300 ? '...' : '');
    lines.push(`"${preview}"\n`);
  }
  if (content.instagram && platforms.includes('INSTAGRAM')) {
    lines.push(`📸 *Instagram:*`);
    lines.push(`"${content.instagram.content.slice(0, 200)}..."\n`);
    if (content.instagram.hashtags?.length) {
      lines.push(content.instagram.hashtags.slice(0, 5).join(' ') + '\n');
    }
  }
  if (content.threads && platforms.includes('THREADS')) {
    lines.push(`🧵 *Threads* (${content.threads.charCount} chars):`);
    lines.push(`"${content.threads.content}"\n`);
  }

  lines.push('Ready to post?');
  return lines.join('\n');
}

// ---- Entry point: Step 1 (triggered by /post or /start) --------------

export async function startPublishFlow(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const firstName = ctx.from?.first_name ?? 'there';

  const session: BotSession = { step: 'POST_TYPE' };
  await setSession(chatId, session);

  await ctx.reply(
    `Hey ${firstName} 👋 What type of post is this?`,
    { reply_markup: postTypeKeyboard() }
  );
}

// ---- Main text handler (for IDEA step) --------------------------------

export async function handlePublishConversation(ctx: Context, session: BotSession): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text ?? '';

  if (session.step === 'IDEA') {
    if (text.length > 500) {
      await ctx.reply("That's a bit long! Please keep it under 500 characters. Try again 📝");
      return;
    }

    session.idea = text;
    await ctx.reply('Generating your content... ⚙️');

    try {
      // Look up the linked Postly user ID via telegramChatId
      const user = session.userId
        ? await prisma.user.findUnique({ where: { id: session.userId } })
        : await prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });

      if (!user) {
        await ctx.reply(
          "You haven't linked your Postly account yet. Visit the web app, go to Profile settings, and link your Telegram account."
        );
        await clearSession(chatId);
        return;
      }

      session.userId = user.id;

      const aiResult = await generateContent({
        idea: session.idea!,
        postType: (session.postType as PostType) ?? PostType.ANNOUNCEMENT,
        platforms: (session.platforms ?? ['TWITTER']) as Platform[],
        tone: (session.tone as Tone) ?? Tone.PROFESSIONAL,
        language: 'en',
        model: (session.model as 'openai' | 'anthropic') ?? 'openai',
        userId: user.id,
      });

      // Store generated content as typed GeneratedContent
      session.generatedContent = aiResult.generated as GeneratedContent;
      session.step = 'CONFIRM';
      await setSession(chatId, session);

      const formattedContent = formatGeneratedContent(
        session.generatedContent,
        session.platforms ?? []
      );

      await ctx.reply(formattedContent, {
        parse_mode: 'Markdown',
        reply_markup: confirmKeyboard(),
      });
    } catch (err) {
      logger.error('[Bot] Content generation failed', { error: (err as Error).message });
      await ctx.reply(
        "Sorry, content generation failed. This might be a temporary issue. Please try again with /post"
      );
      await clearSession(chatId);
    }
  }
}

// ---- Callback query handler ------------------------------------------

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? '';

  // Always answer the callback to remove the loading spinner
  await ctx.answerCallbackQuery();

  const session = await getSession(chatId);
  if (!session) {
    await ctx.reply("Your session expired 😴 Send /post to start a new one.");
    return;
  }

  // ---- POST_TYPE step ------------------------------------------------
  if (data.startsWith('pt:') && session.step === 'POST_TYPE') {
    session.postType = data.replace('pt:', '');
    session.step = 'PLATFORMS';
    session.platforms = [];
    await setSession(chatId, session);

    await ctx.reply(
      'Which platforms should I post to? (select all that apply, then tap Done ✅)',
      { reply_markup: platformKeyboard(session.platforms) }
    );
    return;
  }

  // ---- PLATFORMS step ------------------------------------------------
  if (data.startsWith('pf:') && session.step === 'PLATFORMS') {
    const action = data.replace('pf:', '');
    session.platforms = session.platforms ?? [];

    if (action === 'ALL') {
      session.platforms = ['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'THREADS'];
    } else if (action === 'DONE') {
      if (session.platforms.length === 0) {
        await ctx.reply('Please select at least one platform before tapping Done ✅');
        return;
      }
      session.step = 'TONE';
      await setSession(chatId, session);

      await ctx.reply('What tone should the content have?', { reply_markup: toneKeyboard() });
      return;
    } else {
      // Toggle platform selection
      const idx = session.platforms.indexOf(action);
      if (idx === -1) {
        session.platforms.push(action);
      } else {
        session.platforms.splice(idx, 1);
      }
    }

    await setSession(chatId, session);
    // Update keyboard to reflect selection state
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: platformKeyboard(session.platforms) });
    } catch {
      // Ignore "message not modified" errors from Telegram
    }
    return;
  }

  // ---- TONE step -----------------------------------------------------
  if (data.startsWith('tone:') && session.step === 'TONE') {
    session.tone = data.replace('tone:', '');
    session.step = 'MODEL';
    await setSession(chatId, session);

    await ctx.reply('Which AI model do you want to use?', { reply_markup: modelKeyboard() });
    return;
  }

  // ---- MODEL step ----------------------------------------------------
  if (data.startsWith('model:') && session.step === 'MODEL') {
    session.model = data.replace('model:', '');
    session.step = 'IDEA';
    await setSession(chatId, session);

    await ctx.reply(
      'Tell me the idea or core message — keep it brief (max 500 characters). 📝'
    );
    return;
  }

  // ---- CONFIRM step --------------------------------------------------
  if (data.startsWith('confirm:') && session.step === 'CONFIRM') {
    const action = data.replace('confirm:', '');

    if (action === 'cancel') {
      await clearSession(chatId);
      await ctx.reply("Post cancelled. Send /post to start a new one.");
      return;
    }

    if (action === 'edit') {
      session.step = 'IDEA';
      await setSession(chatId, session);
      await ctx.reply("Let's try again. Tell me your idea (max 500 characters): 📝");
      return;
    }

    if (action === 'post') {
      if (!session.userId) {
        await ctx.reply("Can't find your linked account. Please re-link via the web app.");
        await clearSession(chatId);
        return;
      }

      try {
        // Queue the publishing jobs — same service used by REST API
        const result = await publishPost(session.userId, {
          idea: session.idea!,
          postType: (session.postType as PostType),
          platforms: (session.platforms as Platform[]),
          tone: (session.tone as Tone),
          language: 'en',
          model: (session.model as 'openai' | 'anthropic'),
        });

        const platformLines = (session.platforms ?? [])
          .map((p) => {
            const emoji = { TWITTER: '🐦', LINKEDIN: '💼', INSTAGRAM: '📸', THREADS: '🧵' }[p] ?? '📱';
            return `${emoji} ${p} — Queued ⏳`;
          })
          .join('\n');

        await ctx.reply(
          `🚀 Your post is being published!\n\nPlatform status:\n${platformLines}\n\nI'll update you when each platform publishes. Use /status to check progress.`
        );

        await clearSession(chatId);
      } catch (err) {
        logger.error('[Bot] Publish failed', { error: (err as Error).message });
        await ctx.reply("Sorry, publishing failed. Please try again with /post");
        await clearSession(chatId);
      }
      return;
    }
  }

  // ---- Unexpected callback -------------------------------------------
  await ctx.reply("I didn't understand that. Please use the buttons above, or send /post to start over.");
}

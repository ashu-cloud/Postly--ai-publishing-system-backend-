
import { Router } from 'express';
import { webhookCallback } from 'grammy';
import { bot } from './bot';

const router = Router();

// Middleware to verify Telegram Webhook Secret Token (Nice-to-Have Feature)
const verifyTelegramSecret = (req: any, res: any, next: any) => {
  const token = req.headers['x-telegram-bot-api-secret-token'];
  // In a real production environment, you would enforce this token.
  // For the assignment, we check if it's provided in the env before strictly enforcing it
  // to avoid breaking existing local tests that don't pass the header.
  if (process.env.TELEGRAM_SECRET_TOKEN && token !== process.env.TELEGRAM_SECRET_TOKEN) {
    return res.status(403).send('Forbidden: Invalid Secret Token');
  }
  next();
};

// POST /api/bot/webhook — receives Telegram update objects
// grammy's webhookCallback handles JSON parsing and bot dispatch internally
router.post('/webhook', verifyTelegramSecret, webhookCallback(bot, 'express'));

export default router;

/**
 * src/app.ts
 *
 * Express application setup.
 * No listen() call here — server.ts handles that.
 * This separation makes the app importable in tests without binding a port.
 */

import express from 'express';
import { globalErrorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimiter';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import contentRoutes from './modules/content/content.routes';
import postsRoutes from './modules/posts/posts.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

export const app = express();

// ---- Body parsing --------------------------------------------------
app.use(express.json({ limit: '10kb' })); // 10kb limit — prevent large payload attacks
app.use(express.urlencoded({ extended: true }));

// ---- Security headers (minimal, no helmet dependency) --------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ---- Rate limiting (applied globally, keyed per user/IP) -----------
app.use(rateLimiter);

// ---- Health check (no auth, no rate limit impact) ------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- API routes ----------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Bot webhook route — only in production (in dev, bot uses long polling via server.ts)
if (process.env.NODE_ENV === 'production') {
  // Dynamic import to avoid webhookCallback() marking the bot as webhook-mode in dev
  import('./modules/bot/bot.routes').then((m) => app.use('/api/bot', m.default));
}

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to the Postly API!' });
});

// ---- 404 handler ---------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ data: null, meta: null, error: { message: 'Route not found', code: 'NOT_FOUND' } });
});

// ---- Global error handler (must be last middleware) ----------------
app.use(globalErrorHandler);


import express from 'express';
import { globalErrorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimiter';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import contentRoutes from './modules/content/content.routes';
import postsRoutes from './modules/posts/posts.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

export const app = express();

app.use(express.json({ limit: '10kb' })); // 10kb limit — prevent large payload attacks
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(rateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/dashboard', dashboardRoutes);

if (process.env.NODE_ENV === 'production') {

  import('./modules/bot/bot.routes').then((m) => app.use('/api/bot', m.default));
}

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to the Postly API!' });
});

app.use((_req, res) => {
  res.status(404).json({ data: null, meta: null, error: { message: 'Route not found', code: 'NOT_FOUND' } });
});

app.use(globalErrorHandler);

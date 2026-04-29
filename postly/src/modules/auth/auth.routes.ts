
import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import * as authController from './auth.controller';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from './auth.schema';

const router = Router();

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), authController.register);

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), authController.login);

// POST /api/auth/refresh
router.post('/refresh', validateBody(refreshSchema), authController.refresh);

// POST /api/auth/logout — protected, requires valid access token
router.post('/logout', requireAuth, validateBody(logoutSchema), authController.logout);

// GET /api/auth/me — protected
router.get('/me', requireAuth, authController.me);

export default router;


import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { getStats } from './dashboard.controller';

const router = Router();
router.get('/stats', requireAuth, getStats);

export default router;

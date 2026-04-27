/**
 * src/modules/content/content.routes.ts
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { generate } from './content.controller';
import { generateContentSchema } from './content.schema';

const router = Router();

// POST /api/content/generate — protected
router.post('/generate', requireAuth, validateBody(generateContentSchema), generate);

export default router;

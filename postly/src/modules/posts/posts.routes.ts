
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate, validateBody } from '../../middleware/validate.middleware';
import * as postsController from './posts.controller';
import { publishSchema, scheduleSchema, listPostsQuerySchema } from './posts.schema';

const router = Router();
router.use(requireAuth);

router.post('/publish', validateBody(publishSchema), postsController.publishPost);
router.post('/schedule', validateBody(scheduleSchema), postsController.schedulePost);
router.get('/', validate({ query: listPostsQuerySchema }), postsController.listPosts);
router.get('/:id', postsController.getPost);
router.post('/:id/retry', postsController.retryPost);
router.delete('/:id', postsController.deletePost);
router.post('/:id/restore', postsController.restorePost);
router.get('/:id/analytics', postsController.getPostAnalytics);

export default router;

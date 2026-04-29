
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import * as userController from './user.controller';
import { updateProfileSchema, addSocialAccountSchema, updateAiKeysSchema } from './user.schema';

const router = Router();

// All user routes are protected
router.use(requireAuth);

router.get('/profile', userController.getProfile);
router.put('/profile', validateBody(updateProfileSchema), userController.updateProfile);
router.post('/social-accounts', validateBody(addSocialAccountSchema), userController.addSocialAccount);
router.get('/social-accounts', userController.getSocialAccounts);
router.delete('/social-accounts/:id', userController.deleteSocialAccount);
router.put('/ai-keys', validateBody(updateAiKeysSchema), userController.updateAiKeys);

export default router;

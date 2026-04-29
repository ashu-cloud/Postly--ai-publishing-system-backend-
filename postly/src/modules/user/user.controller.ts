
import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import { successResponse } from '../../utils/response';
import type { UpdateProfileInput, AddSocialAccountInput, UpdateAiKeysInput } from './user.schema';

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getProfile(req.user!.id);
    res.json(successResponse({ user }));
  } catch (err) { next(err); }
}

export async function updateProfile(
  req: Request<object, object, UpdateProfileInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.updateProfile(req.user!.id, req.body);
    res.json(successResponse({ user }));
  } catch (err) { next(err); }
}

export async function addSocialAccount(
  req: Request<object, object, AddSocialAccountInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const account = await userService.addSocialAccount(req.user!.id, req.body);
    res.status(201).json(successResponse({ account }));
  } catch (err) { next(err); }
}

export async function getSocialAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accounts = await userService.getSocialAccounts(req.user!.id);
    res.json(successResponse({ accounts }));
  } catch (err) { next(err); }
}

export async function deleteSocialAccount(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await userService.deleteSocialAccount(req.user!.id, req.params.id);
    res.json(successResponse({ message: 'Social account removed' }));
  } catch (err) { next(err); }
}

export async function updateAiKeys(
  req: Request<object, object, UpdateAiKeysInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await userService.updateAiKeys(req.user!.id, req.body);
    res.json(successResponse(result));
  } catch (err) { next(err); }
}

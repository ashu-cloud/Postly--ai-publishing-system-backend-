
import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { successResponse } from '../../utils/response';
import type { RegisterInput, LoginInput, RefreshInput, LogoutInput } from './auth.schema';

export async function register(
  req: Request<object, object, RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request<object, object, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request<object, object, RefreshInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.refreshTokens(req.body);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request<object, object, LogoutInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.logoutUser(req.user!.id, req.body.refresh_token);
    res.status(200).json(successResponse({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    res.status(200).json(successResponse({ user }));
  } catch (err) {
    next(err);
  }
}


import { Request, Response, NextFunction } from 'express';
import * as postsService from './posts.service';
import { successResponse } from '../../utils/response';
import type { PublishInput, ScheduleInput, ListPostsQuery } from './posts.schema';

export async function publishPost(
  req: Request<object, object, PublishInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.publishPost(req.user!.id, req.body);
    res.status(201).json(successResponse(result));
  } catch (err) { next(err); }
}

export async function schedulePost(
  req: Request<object, object, ScheduleInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.schedulePost(req.user!.id, req.body);
    res.status(201).json(successResponse(result));
  } catch (err) { next(err); }
}

export async function listPosts(
  req: Request<object, object, object, ListPostsQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { posts, meta } = await postsService.listPosts(req.user!.id, req.query);
    res.json(successResponse(posts, meta));
  } catch (err) { next(err); }
}

export async function getPost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const post = await postsService.getPost(req.user!.id, req.params.id);
    res.json(successResponse(post));
  } catch (err) { next(err); }
}

export async function retryPost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.retryPost(req.user!.id, req.params.id);
    res.json(successResponse(result));
  } catch (err) { next(err); }
}

export async function deletePost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.deletePost(req.user!.id, req.params.id);
    res.json(successResponse(result));
  } catch (err) { next(err); }
}

export async function restorePost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.restorePost(req.user!.id, req.params.id);
    res.json(successResponse(result));
  } catch (err) { next(err); }
}

export async function getPostAnalytics(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await postsService.getPostAnalytics(req.user!.id, req.params.id);
    res.json(successResponse(result));
  } catch (err) { next(err); }
}

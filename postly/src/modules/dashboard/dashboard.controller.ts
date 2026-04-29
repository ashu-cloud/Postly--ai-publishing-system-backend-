
import { Request, Response, NextFunction } from 'express';
import { getDashboardStats } from './dashboard.service';
import { successResponse } from '../../utils/response';

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getDashboardStats(req.user!.id);
    res.json(successResponse(stats));
  } catch (err) { next(err); }
}

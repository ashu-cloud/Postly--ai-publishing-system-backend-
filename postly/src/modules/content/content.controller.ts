/**
 * src/modules/content/content.controller.ts
 */

import { Request, Response, NextFunction } from 'express';
import { generateContent } from './content.service';
import { successResponse } from '../../utils/response';
import type { GenerateContentInput } from './content.schema';

export async function generate(
  req: Request<object, object, GenerateContentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await generateContent(req.user!.id, req.body);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

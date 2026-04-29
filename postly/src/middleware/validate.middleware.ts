
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { errorResponse } from '../utils/response';

interface ValidationTarget {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Collect all field errors into a readable message
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        res.status(400).json(errorResponse(messages, 'VALIDATION_ERROR'));
        return;
      }
      next(err);
    }
  };
}

/** Convenience shorthand for body-only validation */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

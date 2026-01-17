import { Request, Response, NextFunction } from 'express';
import { ObjectSchema } from 'joi';
import { CustomError } from './errorHandler';

export const validateBody = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');

      const validationError: CustomError = new Error(`Validation error: ${errorMessage}`);
      validationError.statusCode = 400;
      validationError.details = error.details;
      return next(validationError);
    }

    req.body = value;
    next();
  };
};

export const validateParams = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');

      const validationError: CustomError = new Error(`Validation error: ${errorMessage}`);
      validationError.statusCode = 400;
      validationError.details = error.details;
      return next(validationError);
    }

    req.params = value;
    next();
  };
};

export const validateQuery = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');

      const validationError: CustomError = new Error(`Validation error: ${errorMessage}`);
      validationError.statusCode = 400;
      validationError.details = error.details;
      return next(validationError);
    }

    (req as any).validatedQuery = value;
    next();
  };
};
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error Handler Middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      ...(error.details && { details: error.details }),
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON',
      code: 'INVALID_JSON',
    });
  }

  // Database errors
  if (error instanceof Error && error.message.includes('duplicate key')) {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
    });
  }

  if (error instanceof Error && error.message.includes('FOREIGN KEY')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reference to related resource',
      code: 'INVALID_FOREIGN_KEY',
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { error: error.message }),
  });
};

// Async Error Wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 Handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
};

// Handle uncaught exceptions
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

// Handle unhandled promise rejections
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

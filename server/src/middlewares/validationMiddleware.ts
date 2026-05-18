import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// Validation Error Response
interface ValidationErrorResponse {
  success: false;
  message: string;
  code: string;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

// Validate Request Middleware Factory
export const validateRequest = (options: ValidationOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: Array<{ path: string; message: string; code: string }> = [];

      // Validate body
      if (options.body) {
        const bodyResult = await options.body.safeParseAsync(req.body);
        if (!bodyResult.success) {
          errors.push(
            ...bodyResult.error.errors.map((e) => ({
              path: `body.${e.path.join('.')}`,
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.body = bodyResult.data;
        }
      }

      // Validate query
      if (options.query) {
        const queryResult = await options.query.safeParseAsync(req.query);
        if (!queryResult.success) {
          errors.push(
            ...queryResult.error.errors.map((e) => ({
              path: `query.${e.path.join('.')}`,
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.query = queryResult.data;
        }
      }

      // Validate params
      if (options.params) {
        const paramsResult = await options.params.safeParseAsync(req.params);
        if (!paramsResult.success) {
          errors.push(
            ...paramsResult.error.errors.map((e) => ({
              path: `params.${e.path.join('.')}`,
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.params = paramsResult.data;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
        } as ValidationErrorResponse);
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
      });
    }
  };
};

// Sanitize Input Middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .substring(0, 10000); // Limit string length
    }

    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = sanitize(value[key]);
        return acc;
      }, {} as any);
    }

    return value;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

// Pagination Middleware
export interface PaginationQuery {
  page?: number;
  limit?: number;
  offset?: number;
}

export const parsePagination = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'))));
  const offset = (page - 1) * limit;

  (req as any).pagination = {
    page,
    limit,
    offset,
  };

  next();
};

// Sorting Middleware
export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export const parseSort = (allowedFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const sort = (req.query.sort as string) || 'createdAt:desc';
    const [field, direction] = sort.split(':');

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort field. Allowed: ${allowedFields.join(', ')}`,
        code: 'INVALID_SORT_FIELD',
      });
    }

    if (!['asc', 'desc'].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: 'Sort direction must be "asc" or "desc"',
        code: 'INVALID_SORT_DIRECTION',
      });
    }

    (req as any).sort = {
      field,
      direction: direction as 'asc' | 'desc',
    };

    next();
  };
};

// Request Size Limit Middleware
export const validateRequestSize = (
  maxBodySize: string = '10mb',
  maxJsonSize: string = '10mb'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxBodySize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: `Request body too large. Maximum: ${maxBodySize}`,
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    next();
  };
};

// Helper to parse size strings like "10mb" to bytes
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.match(/^(\d+)([a-z]+)$/i);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const [, number, unit] = match;
  return parseInt(number) * (units[unit.toLowerCase()] || 1);
}

// Email Validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone Number Validation (E.164 format)
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

// Password Strength Validation
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain numbers');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain special characters (!@#$%^&*)');
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    strength = 'strong';
  } else if (errors.length <= 2) {
    strength = 'medium';
  }

  return {
    isValid: errors.length === 0,
    strength,
    errors,
  };
};

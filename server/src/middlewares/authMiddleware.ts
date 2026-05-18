import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'landlord' | 'tenant';
    phoneNumber?: string;
  };
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Middleware
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const decoded = jwt.verify(token, config.jwt.accessTokenSecret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  }
};

// Role-based Authorization
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Refresh Token Middleware
export const refreshTokenMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if (!refreshToken) {
      throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshTokenSecret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
};

// Optional Authentication (for public endpoints that can show extra data if authenticated)
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret) as any;
      req.user = decoded;
    }
  } catch (error) {
    // Silently fail - user will remain unauthenticated
  }

  next();
};

// Verify Ownership (for resources belonging to specific users)
export const verifyOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const resourceOwnerId = req.params.id || req.body.userId;

    if (!req.user) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    // Allow admins to access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.id !== resourceOwnerId) {
      throw new AppError(
        'You do not own this resource',
        403,
        'OWNERSHIP_DENIED'
      );
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    next(error);
  }
};

// Admin Only
export const adminOnly = authorize('admin');

// Landlord Only
export const landlordOnly = authorize('landlord');

// Tenant Only
export const tenantOnly = authorize('tenant');

// Landlord or Admin
export const landlordOrAdmin = authorize('landlord', 'admin');

// Tenant or Admin
export const tenantOrAdmin = authorize('tenant', 'admin');

import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { UserService } from '../services/userService';
import { registerSchema, loginSchema, otpSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Register
router.post(
  '/register',
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await UserService.register(req.body);
    
    const tokens = {
      accessToken: UserService.generateAccessToken(user),
      refreshToken: UserService.generateRefreshToken(user),
    };

    res.status(201).json({
      success: true,
      data: { user: { ...user, passwordHash: undefined }, tokens },
      message: 'Registration successful',
    });
  })
);

// Login
router.post(
  '/login',
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await UserService.login(req.body.email, req.body.password);

    res.json({
      success: true,
      data: { user: { ...user, passwordHash: undefined }, tokens },
      message: 'Login successful',
    });
  })
);

// Refresh token
router.post(
  '/refresh-token',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const accessToken = await UserService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: { accessToken },
      message: 'Token refreshed',
    });
  })
);

// Request OTP
router.post(
  '/request-otp',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    const otp = await UserService.generateOTP(email);

    // In production, send OTP via email
    console.log(`OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent to email',
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  })
);

// Verify OTP
router.post(
  '/verify-otp',
  validateRequest(otpSchema),
  asyncHandler(async (req, res) => {
    const isValid = await UserService.verifyOTP(req.body.email, req.body.otp);

    res.json({
      success: true,
      data: { verified: isValid },
      message: 'OTP verified successfully',
    });
  })
);

// Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    // In production, invalidate refresh token in Redis
    res.json({
      success: true,
      message: 'Logout successful',
    });
  })
);

export default router;

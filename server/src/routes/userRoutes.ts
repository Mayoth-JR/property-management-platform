import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { UserService } from '../services/userService';
import { idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Get current user profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await UserService.getUserById(req.user!.id);

    res.json({
      success: true,
      data: user,
    });
  })
);

// Update current user profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await UserService.updateProfile(req.user!.id, req.body);

    res.json({
      success: true,
      data: { ...user, passwordHash: undefined },
      message: 'Profile updated successfully',
    });
  })
);

// Get user by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

// List users (admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;

    const { users, total } = await UserService.listUsers(page, limit, role);

    res.json({
      success: true,
      data: users.map(u => ({ ...u, passwordHash: undefined })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Delete user (soft delete)
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    await UserService.deleteUser(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

export default router;

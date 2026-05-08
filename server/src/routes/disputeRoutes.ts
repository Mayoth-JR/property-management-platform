import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { DisputeService } from '../services/disputeService';
import { createDisputeSchema, idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Create dispute
router.post(
  '/',
  authenticate,
  validateRequest(createDisputeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const dispute = await DisputeService.createDispute(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      data: dispute,
      message: 'Dispute created successfully',
    });
  })
);

// Get disputes for lease
router.get(
  '/lease/:leaseId',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { disputes, total } = await DisputeService.getLeaseDisputes(req.params.leaseId, page, limit);

    res.json({
      success: true,
      data: disputes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get user disputes
router.get(
  '/user/disputes',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { disputes, total } = await DisputeService.getUserDisputes(req.user!.id, page, limit);

    res.json({
      success: true,
      data: disputes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get dispute by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const dispute = await DisputeService.getDisputeById(req.params.id);

    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Dispute not found' });
    }

    res.json({
      success: true,
      data: dispute,
    });
  })
);

// Update dispute status (admin only)
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const { status, resolution } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status required' });
    }

    const updated = await DisputeService.updateDisputeStatus(req.params.id, status, resolution);

    res.json({
      success: true,
      data: updated,
      message: 'Dispute updated successfully',
    });
  })
);

// Get open disputes (admin only)
router.get(
  '/list/open',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const disputes = await DisputeService.getOpenDisputes();

    res.json({
      success: true,
      data: disputes,
    });
  })
);

// Get dispute statistics (admin only)
router.get(
  '/analytics/statistics',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const stats = await DisputeService.getDisputeStatistics();

    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get disputes by category (admin only)
router.get(
  '/analytics/by-category',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const byCategory = await DisputeService.getDisputesByCategory();

    res.json({
      success: true,
      data: byCategory,
    });
  })
);

// Get landlord disputes
router.get(
  '/landlord/disputes',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { disputes, total } = await DisputeService.getLandlordDisputes(req.user!.id, page, limit);

    res.json({
      success: true,
      data: disputes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

export default router;

import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { LeaseService } from '../services/leaseService';
import { createLeaseSchema, idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Create lease (landlord only)
router.post(
  '/',
  authenticate,
  authorize(['landlord']),
  validateRequest(createLeaseSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const lease = await LeaseService.createLease(req.body);

    res.status(201).json({
      success: true,
      data: lease,
      message: 'Lease created successfully',
    });
  })
);

// Get tenant leases
router.get(
  '/tenant/leases',
  authenticate,
  authorize(['tenant']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { leases, total } = await LeaseService.getTenantLeases(req.user!.id, page, limit);

    res.json({
      success: true,
      data: leases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get landlord leases
router.get(
  '/landlord/leases',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { leases, total } = await LeaseService.getLandlordLeases(req.user!.id, page, limit);

    res.json({
      success: true,
      data: leases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get lease by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const lease = await LeaseService.getLeaseById(req.params.id);

    if (!lease) {
      return res.status(404).json({ success: false, error: 'Lease not found' });
    }

    res.json({
      success: true,
      data: lease,
    });
  })
);

// Sign lease as tenant
router.patch(
  '/:id/sign-tenant',
  authenticate,
  authorize(['tenant']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const lease = await LeaseService.signLeaseAsTenant(req.params.id, req.user!.id);

    res.json({
      success: true,
      data: lease,
      message: 'Lease signed successfully',
    });
  })
);

// Sign lease as landlord
router.patch(
  '/:id/sign-landlord',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const lease = await LeaseService.signLeaseAsLandlord(req.params.id, req.user!.id);

    res.json({
      success: true,
      data: lease,
      message: 'Lease signed successfully',
    });
  })
);

// Get lease status
router.get(
  '/:id/status',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const status = await LeaseService.getLeaseStatus(req.params.id);

    res.json({
      success: true,
      data: status,
    });
  })
);

// Terminate lease (landlord only)
router.patch(
  '/:id/terminate',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { terminationReason } = req.body;

    if (!terminationReason) {
      return res.status(400).json({ success: false, error: 'Termination reason required' });
    }

    const lease = await LeaseService.terminateLease(req.params.id, terminationReason);

    res.json({
      success: true,
      data: lease,
      message: 'Lease terminated successfully',
    });
  })
);

// Get active leases
router.get(
  '/list/active',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const leases = await LeaseService.getActiveLeases();

    res.json({
      success: true,
      data: leases,
    });
  })
);

// Get expiring leases
router.get(
  '/list/expiring',
  authenticate,
  authorize(['admin', 'landlord']),
  asyncHandler(async (req, res) => {
    const leases = await LeaseService.getExpiringLeases();

    res.json({
      success: true,
      data: leases,
    });
  })
);

export default router;

import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { MaintenanceService } from '../services/maintenanceService';
import { createMaintenanceSchema, idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Create maintenance request
router.post(
  '/',
  authenticate,
  authorize(['tenant']),
  validateRequest(createMaintenanceSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await MaintenanceService.createMaintenanceRequest(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      data: request,
      message: 'Maintenance request submitted',
    });
  })
);

// Get property maintenance requests
router.get(
  '/property/:propertyId',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { requests, total } = await MaintenanceService.getPropertyMaintenanceRequests(
      req.params.propertyId,
      page,
      limit
    );

    res.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get tenant maintenance requests
router.get(
  '/tenant/requests',
  authenticate,
  authorize(['tenant']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { requests, total } = await MaintenanceService.getTenantMaintenanceRequests(
      req.user!.id,
      page,
      limit
    );

    res.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get maintenance request by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const request = await MaintenanceService.getMaintenanceById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Maintenance request not found' });
    }

    res.json({
      success: true,
      data: request,
    });
  })
);

// Update maintenance status (landlord/staff only)
router.patch(
  '/:id/status',
  authenticate,
  authorize(['landlord', 'admin']),
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const { status, completionNotes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status required' });
    }

    const updated = await MaintenanceService.updateMaintenanceStatus(req.params.id, status, completionNotes);

    res.json({
      success: true,
      data: updated,
      message: 'Status updated successfully',
    });
  })
);

// Assign maintenance to staff
router.patch(
  '/:id/assign',
  authenticate,
  authorize(['landlord', 'admin']),
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ success: false, error: 'Assigned staff ID required' });
    }

    const updated = await MaintenanceService.assignMaintenance(req.params.id, assignedTo);

    res.json({
      success: true,
      data: updated,
      message: 'Assigned successfully',
    });
  })
);

// Get open maintenance requests (admin only)
router.get(
  '/list/open',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const requests = await MaintenanceService.getOpenMaintenanceRequests();

    res.json({
      success: true,
      data: requests,
    });
  })
);

// Get landlord maintenance statistics
router.get(
  '/landlord/statistics',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req: AuthRequest, res) => {
    const stats = await MaintenanceService.getLandlordMaintenanceStats(req.user!.id);

    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get maintenance by category
router.get(
  '/property/:propertyId/by-category',
  authenticate,
  asyncHandler(async (req, res) => {
    const byCategory = await MaintenanceService.getMaintenanceByCategory(req.params.propertyId);

    res.json({
      success: true,
      data: byCategory,
    });
  })
);

export default router;

import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { ApplicationService } from '../services/applicationService';
import { PropertyService } from '../services/propertyService';
import { applyPropertySchema, idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Apply for property (tenant only)
router.post(
  '/',
  authenticate,
  authorize(['tenant']),
  validateRequest(applyPropertySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const application = await ApplicationService.applyForProperty(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully',
    });
  })
);

// Get tenant applications
router.get(
  '/tenant/applications',
  authenticate,
  authorize(['tenant']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { applications, total } = await ApplicationService.getTenantApplications(req.user!.id, page, limit);

    res.json({
      success: true,
      data: applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get property applications (landlord only)
router.get(
  '/property/:propertyId',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { applications, total } = await ApplicationService.getPropertyApplications(
      req.params.propertyId,
      page,
      limit
    );

    res.json({
      success: true,
      data: applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get application by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const application = await ApplicationService.getApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    res.json({
      success: true,
      data: application,
    });
  })
);

// Approve application (landlord only)
router.patch(
  '/:id/approve',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const application = await ApplicationService.getApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    // Verify property ownership
    const property = await PropertyService.getPropertyById(application.propertyId);
    if (property?.landlordId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const approvalScore = ApplicationService.calculateApprovalScore(
      application.monthlyIncome,
      property.price,
      application.employmentStatus,
      application.numberOfOccupants
    );

    const updated = await ApplicationService.approveApplication(req.params.id, approvalScore);

    res.json({
      success: true,
      data: updated,
      message: 'Application approved successfully',
    });
  })
);

// Reject application (landlord only)
router.patch(
  '/:id/reject',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const application = await ApplicationService.getApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ success: false, error: 'Rejection reason required' });
    }

    const updated = await ApplicationService.rejectApplication(req.params.id, rejectionReason);

    res.json({
      success: true,
      data: updated,
      message: 'Application rejected successfully',
    });
  })
);

// Get application status
router.get(
  '/:id/status',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const status = await ApplicationService.getApplicationStatus(req.params.id);

    res.json({
      success: true,
      data: status,
    });
  })
);

export default router;

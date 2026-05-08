import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { PaymentService } from '../services/paymentService';
import { recordPaymentSchema, idParamSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Record payment
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const payment = await PaymentService.recordPayment(req.body);

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment recorded successfully',
    });
  })
);

// Get payment history for lease
router.get(
  '/lease/:leaseId',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { payments, total } = await PaymentService.getPaymentHistory(req.params.leaseId, page, limit);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get tenant payment history
router.get(
  '/tenant/history',
  authenticate,
  authorize(['tenant']),
  asyncHandler(async (req: AuthRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { payments, total } = await PaymentService.getTenantPaymentHistory(req.user!.id, page, limit);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get payment by ID
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const payment = await PaymentService.getPaymentById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({
      success: true,
      data: payment,
    });
  })
);

// Get payment status
router.get(
  '/:leaseId/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const status = await PaymentService.getPaymentStatus(req.params.leaseId);

    res.json({
      success: true,
      data: status,
    });
  })
);

// Get monthly revenue (landlord only)
router.get(
  '/landlord/monthly-revenue',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req: AuthRequest, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const revenue = await PaymentService.getLandlordMonthlyRevenue(req.user!.id, year, month);

    res.json({
      success: true,
      data: revenue,
    });
  })
);

// Get outstanding payments (landlord only)
router.get(
  '/landlord/outstanding',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req: AuthRequest, res) => {
    const payments = await PaymentService.getOutstandingPayments(req.user!.id);

    res.json({
      success: true,
      data: payments,
    });
  })
);

// Create payment reminder
router.post(
  '/:leaseId/reminder',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req, res) => {
    const { dueDate } = req.body;

    if (!dueDate) {
      return res.status(400).json({ success: false, error: 'Due date required' });
    }

    const reminder = await PaymentService.createPaymentReminder(req.params.leaseId, new Date(dueDate));

    res.status(201).json({
      success: true,
      data: reminder,
      message: 'Payment reminder created',
    });
  })
);

// Get payment summary
router.get(
  '/:leaseId/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const summary = await PaymentService.getPaymentSummary(req.params.leaseId);

    res.json({
      success: true,
      data: summary,
    });
  })
);

export default router;

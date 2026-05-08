import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { AnalyticsService } from '../services/analyticsService';

const router = express.Router();

// Get landlord revenue analytics
router.get(
  '/landlord/revenue',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req, res) => {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const revenue = await AnalyticsService.getLandlordRevenue(req.user!.id, startDate, endDate);

    res.json({
      success: true,
      data: revenue,
    });
  })
);

// Get occupancy rate
router.get(
  '/occupancy',
  authenticate,
  asyncHandler(async (req, res) => {
    const landlordId = req.query.landlordId ? (req.query.landlordId as string) : undefined;

    const occupancy = await AnalyticsService.getOccupancyRate(landlordId);

    res.json({
      success: true,
      data: occupancy,
    });
  })
);

// Get monthly trends
router.get(
  '/trends/monthly',
  authenticate,
  authorize(['landlord']),
  asyncHandler(async (req, res) => {
    const months = req.query.months ? parseInt(req.query.months as string) : 12;

    const trends = await AnalyticsService.getMonthlyTrends(req.user!.id, months);

    res.json({
      success: true,
      data: trends,
    });
  })
);

// Get properties summary
router.get(
  '/properties/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const landlordId = req.query.landlordId ? (req.query.landlordId as string) : undefined;

    const summary = await AnalyticsService.getPropertiesSummary(landlordId);

    res.json({
      success: true,
      data: summary,
    });
  })
);

// Get tenant analytics
router.get(
  '/tenant/:tenantId',
  authenticate,
  authorize(['tenant', 'admin']),
  asyncHandler(async (req, res) => {
    const analytics = await AnalyticsService.getTenantAnalytics(req.params.tenantId);

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// Get system-wide analytics (admin only)
router.get(
  '/system/overview',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const analytics = await AnalyticsService.getSystemAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// Get payment distribution
router.get(
  '/payments/distribution',
  authenticate,
  asyncHandler(async (req, res) => {
    const landlordId = req.query.landlordId ? (req.query.landlordId as string) : undefined;

    const distribution = await AnalyticsService.getPaymentDistribution(landlordId);

    res.json({
      success: true,
      data: distribution,
    });
  })
);

// Get admin dashboard
router.get(
  '/dashboard/admin',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const dashboard = await AnalyticsService.getAdminDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  })
);

export default router;

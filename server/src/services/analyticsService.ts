import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class AnalyticsService {
  /**
   * Record analytics event
   */
  static async recordEvent(userId: string, eventType: string, eventData: any) {
    try {
      const eventId = uuidv4();
      await pool.query(
        `INSERT INTO analytics_events (id, user_id, event_type, event_data, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [eventId, userId, eventType, JSON.stringify(eventData)]
      );

      return { success: true, eventId };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get revenue dashboard
   */
  static async getRevenueDashboard(landlordId: string) {
    try {
      // Total revenue
      const revenueResult = await pool.query(
        `SELECT 
          SUM(p.amount) as total_revenue,
          COUNT(p.id) as total_payments,
          AVG(p.amount) as average_payment
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         WHERE l.landlord_id = $1 AND p.status = 'completed'`,
        [landlordId]
      );

      // Revenue by month
      const monthlyResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', p.created_at)::DATE as month,
          SUM(p.amount) as revenue
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         WHERE l.landlord_id = $1 AND p.status = 'completed'
         GROUP BY DATE_TRUNC('month', p.created_at)
         ORDER BY month DESC
         LIMIT 12`,
        [landlordId]
      );

      // Revenue by property
      const propertyResult = await pool.query(
        `SELECT 
          p.id, p.title, SUM(py.amount) as revenue
         FROM properties p
         LEFT JOIN leases l ON p.id = l.property_id
         LEFT JOIN payments py ON l.id = py.lease_id AND py.status = 'completed'
         WHERE p.landlord_id = $1
         GROUP BY p.id, p.title
         ORDER BY revenue DESC`,
        [landlordId]
      );

      return {
        summary: revenueResult.rows[0],
        monthly: monthlyResult.rows,
        byProperty: propertyResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get occupancy dashboard
   */
  static async getOccupancyDashboard(landlordId: string) {
    try {
      // Total properties vs occupied
      const occupancyResult = await pool.query(
        `SELECT 
          COUNT(*) as total_properties,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_properties,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_properties,
          ROUND(100.0 * SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) / COUNT(*), 2) as occupancy_rate
         FROM properties
         WHERE landlord_id = $1 AND deleted_at IS NULL`,
        [landlordId]
      );

      // Occupancy by property type
      const byTypeResult = await pool.query(
        `SELECT 
          property_type,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied
         FROM properties
         WHERE landlord_id = $1 AND deleted_at IS NULL
         GROUP BY property_type`,
        [landlordId]
      );

      // Lease expiration timeline
      const expirationResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', l.end_date)::DATE as expiration_month,
          COUNT(*) as expiring_leases
         FROM leases l
         WHERE l.landlord_id = $1 AND l.status = 'active' AND l.end_date > NOW()
         GROUP BY DATE_TRUNC('month', l.end_date)
         ORDER BY expiration_month ASC`,
        [landlordId]
      );

      return {
        summary: occupancyResult.rows[0],
        byType: byTypeResult.rows,
        expiringLeases: expirationResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant analytics
   */
  static async getTenantAnalytics(tenantId: string) {
    try {
      // Active leases
      const activeLeasesResult = await pool.query(
        `SELECT COUNT(*) as active_leases FROM leases WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId]
      );

      // Payment history
      const paymentResult = await pool.query(
        `SELECT 
          COUNT(*) as total_payments,
          SUM(amount) as total_paid,
          AVG(amount) as average_payment
         FROM payments
         WHERE tenant_id = $1 AND status = 'completed'`,
        [tenantId]
      );

      // Maintenance requests
      const maintenanceResult = await pool.query(
        `SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests
         FROM maintenance_requests
         WHERE tenant_id = $1`,
        [tenantId]
      );

      // Payment trends
      const trendsResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', created_at)::DATE as month,
          COUNT(*) as payments,
          SUM(amount) as revenue
         FROM payments
         WHERE tenant_id = $1 AND status = 'completed'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month DESC
         LIMIT 6`,
        [tenantId]
      );

      return {
        activeLeases: activeLeasesResult.rows[0].active_leases,
        payments: paymentResult.rows[0],
        maintenance: maintenanceResult.rows[0],
        trends: trendsResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get system-wide analytics (Admin)
   */
  static async getSystemAnalytics() {
    try {
      // User statistics
      const usersResult = await pool.query(
        `SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'landlord' THEN 1 ELSE 0 END) as landlords,
          SUM(CASE WHEN role = 'tenant' THEN 1 ELSE 0 END) as tenants
         FROM users WHERE deleted_at IS NULL`
      );

      // Property statistics
      const propertiesResult = await pool.query(
        `SELECT 
          COUNT(*) as total_properties,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
          AVG(rent_price) as average_rent,
          SUM(rent_price) as total_monthly_potential_revenue
         FROM properties WHERE deleted_at IS NULL`
      );

      // Lease statistics
      const leasesResult = await pool.query(
        `SELECT 
          COUNT(*) as total_leases,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_leases,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_leases,
          SUM(rent_amount) as total_monthly_rent
         FROM leases`
      );

      // Payment statistics
      const paymentsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_payments,
          SUM(amount) as total_revenue,
          AVG(amount) as average_payment,
          DATE_TRUNC('month', NOW())::DATE as current_month
         FROM payments WHERE status = 'completed'`
      );

      // Application statistics
      const applicationsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_applications,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
         FROM applications`
      );

      // Maintenance statistics
      const maintenanceResult = await pool.query(
        `SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM maintenance_requests WHERE deleted_at IS NULL`
      );

      // Dispute statistics
      const disputesResult = await pool.query(
        `SELECT 
          COUNT(*) as total_disputes,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_disputes,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_disputes,
          SUM(claimed_amount) as total_claimed
         FROM disputes`
      );

      return {
        users: usersResult.rows[0],
        properties: propertiesResult.rows[0],
        leases: leasesResult.rows[0],
        payments: paymentsResult.rows[0],
        applications: applicationsResult.rows[0],
        maintenance: maintenanceResult.rows[0],
        disputes: disputesResult.rows[0],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get trends analysis
   */
  static async getTrendsAnalysis(months: number = 12) {
    try {
      // Revenue trends
      const revenueResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', p.created_at)::DATE as month,
          SUM(p.amount) as revenue,
          COUNT(p.id) as payment_count
         FROM payments p
         WHERE p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '${months} months'
         GROUP BY DATE_TRUNC('month', p.created_at)
         ORDER BY month ASC`
      );

      // Application trends
      const applicationResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', created_at)::DATE as month,
          COUNT(*) as total_applications,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
         FROM applications
         WHERE created_at >= NOW() - INTERVAL '${months} months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month ASC`
      );

      // Maintenance trends
      const maintenanceResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', created_at)::DATE as month,
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          AVG(EXTRACT(DAY FROM updated_at - created_at)) as avg_resolution_days
         FROM maintenance_requests
         WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '${months} months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month ASC`
      );

      return {
        revenue: revenueResult.rows,
        applications: applicationResult.rows,
        maintenance: maintenanceResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get top performing properties
   */
  static async getTopProperties(landlordId?: string, limit: number = 10) {
    try {
      let query = `SELECT 
                    p.id, p.title, p.address, p.rent_price,
                    COUNT(l.id) as total_leases,
                    SUM(py.amount) as total_revenue,
                    CASE WHEN l.status = 'active' THEN true ELSE false END as currently_occupied
                   FROM properties p
                   LEFT JOIN leases l ON p.id = l.property_id
                   LEFT JOIN payments py ON l.id = py.lease_id AND py.status = 'completed'
                   WHERE p.deleted_at IS NULL`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND p.landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      query += ` GROUP BY p.id, p.title, p.address, p.rent_price, l.status
                 ORDER BY total_revenue DESC
                 LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user activity log
   */
  static async getUserActivityLog(userId: string, limit: number = 50) {
    try {
      const result = await pool.query(
        `SELECT 
          event_type, event_data, created_at
         FROM analytics_events
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment collection rate
   */
  static async getPaymentCollectionRate(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(DISTINCT l.id) as total_active_leases,
                    COUNT(DISTINCT p.lease_id) as leases_with_payments,
                    ROUND(100.0 * COUNT(DISTINCT p.lease_id) / COUNT(DISTINCT l.id), 2) as collection_rate
                   FROM leases l
                   LEFT JOIN payments p ON l.id = p.lease_id AND p.status = 'completed'
                   WHERE l.status = 'active'`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get application approval rate
   */
  static async getApplicationApprovalRate(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_applications,
                    SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) as approved_applications,
                    SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_applications,
                    ROUND(100.0 * SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) / COUNT(*), 2) as approval_rate
                   FROM applications a
                   JOIN properties p ON a.property_id = p.id
                   WHERE 1=1`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND p.landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export analytics data to CSV format
   */
  static async exportAnalyticsData(landlordId: string, dataType: string) {
    try {
      let query = '';
      let filename = '';

      if (dataType === 'payments') {
        query = `SELECT p.id, p.amount, p.payment_method, p.created_at, u.email, pr.title
                FROM payments p
                JOIN leases l ON p.lease_id = l.id
                JOIN users u ON p.tenant_id = u.id
                JOIN properties pr ON l.property_id = pr.id
                WHERE l.landlord_id = $1 AND p.status = 'completed'
                ORDER BY p.created_at DESC`;
        filename = 'payments.csv';
      } else if (dataType === 'properties') {
        query = `SELECT id, title, address, city, rent_price, bedrooms, bathrooms, status, created_at
                FROM properties
                WHERE landlord_id = $1 AND deleted_at IS NULL
                ORDER BY created_at DESC`;
        filename = 'properties.csv';
      } else if (dataType === 'applications') {
        query = `SELECT a.id, a.status, a.approval_score, a.created_at, u.email, pr.title
                FROM applications a
                JOIN properties pr ON a.property_id = pr.id
                JOIN users u ON a.tenant_id = u.id
                WHERE pr.landlord_id = $1
                ORDER BY a.created_at DESC`;
        filename = 'applications.csv';
      }

      if (!query) {
        throw new Error('Invalid data type');
      }

      const result = await pool.query(query, [landlordId]);
      return {
        filename,
        data: result.rows,
      };
    } catch (error) {
      throw error;
    }
  }
}

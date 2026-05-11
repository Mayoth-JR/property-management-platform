import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface PaymentInput {
  leaseId: string;
  tenantId: string;
  amount: number;
  paymentMethod: 'mpesa' | 'airtel_money' | 'tigo_pesa' | 'bank_transfer' | 'cash';
  transactionReference: string;
  notes?: string;
}

export class PaymentService {
  /**
   * Record payment
   */
  static async recordPayment(input: PaymentInput) {
    try {
      const paymentId = uuidv4();
      const result = await pool.query(
        `INSERT INTO payments (
          id, lease_id, tenant_id, amount, payment_method, transaction_reference,
          notes, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          paymentId,
          input.leaseId,
          input.tenantId,
          input.amount,
          input.paymentMethod,
          input.transactionReference,
          input.notes || '',
          'completed',
        ]
      );

      // Update lease payment tracking
      await this.updateLeasePaymentTracking(input.leaseId);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  static async getPaymentById(paymentId: string) {
    try {
      const result = await pool.query(
        `SELECT p.*, l.rent_amount, u.email, u.first_name, u.last_name
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         JOIN users u ON p.tenant_id = u.id
         WHERE p.id = $1`,
        [paymentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Payment not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment history
   */
  static async getPaymentHistory(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE p.status = $1';
      const params = ['completed'];

      if (filters?.leaseId) {
        whereClause += ` AND p.lease_id = $${params.length + 1}`;
        params.push(filters.leaseId);
      }

      if (filters?.tenantId) {
        whereClause += ` AND p.tenant_id = $${params.length + 1}`;
        params.push(filters.tenantId);
      }

      if (filters?.landlordId) {
        whereClause += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(filters.landlordId);
      }

      if (filters?.startDate && filters?.endDate) {
        whereClause += ` AND p.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(filters.startDate, filters.endDate);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM payments p JOIN leases l ON p.lease_id = l.id ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT p.id, p.lease_id, p.amount, p.payment_method, p.created_at,
                l.rent_amount, u.first_name, u.last_name, u.email
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         JOIN users u ON p.tenant_id = u.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant payment history
   */
  static async getTenantPayments(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT p.id, p.amount, p.payment_method, p.created_at, l.rent_amount, p.lease_id
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         WHERE p.tenant_id = $1 AND p.status = 'completed'
         ORDER BY p.created_at DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get outstanding payments for tenant
   */
  static async getOutstandingPayments(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT l.id, l.rent_amount, l.start_date, l.end_date,
                (DATE_PART('year', NOW()) - DATE_PART('year', l.start_date)) * 12 +
                (DATE_PART('month', NOW()) - DATE_PART('month', l.start_date))
                * l.rent_amount - COALESCE(SUM(p.amount), 0) as outstanding_balance,
                p2.title
         FROM leases l
         LEFT JOIN payments p ON l.id = p.lease_id AND p.status = 'completed'
         JOIN properties p2 ON l.property_id = p2.id
         WHERE l.tenant_id = $1 AND l.status = 'active'
         GROUP BY l.id, p2.title`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get landlord revenue report
   */
  static async getLandlordRevenueReport(landlordId: string, filters?: any) {
    try {
      let whereClause = 'WHERE l.landlord_id = $1';
      const params = [landlordId];

      if (filters?.startDate && filters?.endDate) {
        whereClause += ` AND p.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(filters.startDate, filters.endDate);
      }

      const result = await pool.query(
        `SELECT 
          SUM(p.amount) as total_revenue,
          COUNT(p.id) as total_payments,
          AVG(p.amount) as average_payment,
          MIN(p.created_at) as first_payment,
          MAX(p.created_at) as last_payment,
          COUNT(DISTINCT p.lease_id) as paying_properties
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         ${whereClause}
         AND p.status = 'completed'`,
        params
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get revenue trends
   */
  static async getRevenueTrends(landlordId: string, months: number = 12) {
    try {
      const result = await pool.query(
        `SELECT 
          DATE_TRUNC('month', p.created_at)::DATE as month,
          SUM(p.amount) as revenue,
          COUNT(p.id) as payment_count
         FROM payments p
         JOIN leases l ON p.lease_id = l.id
         WHERE l.landlord_id = $1
         AND p.status = 'completed'
         AND p.created_at >= NOW() - INTERVAL '${months} months'
         GROUP BY DATE_TRUNC('month', p.created_at)
         ORDER BY month DESC`,
        [landlordId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get overdue payments
   */
  static async getOverduePayments(landlordId?: string) {
    try {
      let query = `SELECT 
                    l.id as lease_id, p2.title, l.rent_amount,
                    EXTRACT(DAY FROM NOW() - l.end_date) as days_overdue,
                    u.email, u.first_name, u.last_name
                   FROM leases l
                   JOIN properties p2 ON l.property_id = p2.id
                   JOIN users u ON l.tenant_id = u.id
                   WHERE l.status = 'active' AND l.end_date < NOW()`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      query += ` ORDER BY l.end_date ASC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update lease payment tracking
   */
  static async updateLeasePaymentTracking(leaseId: string) {
    try {
      const result = await pool.query(
        `SELECT l.rent_amount, 
                COALESCE(SUM(p.amount), 0) as total_paid
         FROM leases l
         LEFT JOIN payments p ON l.id = p.lease_id AND p.status = 'completed'
         WHERE l.id = $1
         GROUP BY l.rent_amount`,
        [leaseId]
      );

      if (result.rows.length > 0) {
        const { rent_amount, total_paid } = result.rows[0];
        const isPaidInFull = total_paid >= rent_amount;

        await pool.query(
          `UPDATE leases SET payment_status = $1, last_payment_date = NOW() WHERE id = $2`,
          [isPaidInFull ? 'paid' : 'partial', leaseId]
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send payment reminder
   */
  static async sendPaymentReminder(leaseId: string) {
    try {
      const lease = await pool.query(
        `SELECT l.id, l.rent_amount, u.email, u.first_name
         FROM leases l
         JOIN users u ON l.tenant_id = u.id
         WHERE l.id = $1`,
        [leaseId]
      );

      if (lease.rows.length === 0) {
        throw new Error('Lease not found');
      }

      // Create reminder record
      const reminderId = uuidv4();
      await pool.query(
        `INSERT INTO payment_reminders (id, lease_id, reminder_type, sent_at)
         VALUES ($1, $2, $3, NOW())`,
        [reminderId, leaseId, 'manual']
      );

      return {
        success: true,
        message: 'Payment reminder sent',
        recipient: lease.rows[0].email,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  static async getPaymentStats(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_payments,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    COUNT(DISTINCT lease_id) as properties_paid
                   FROM payments WHERE status = 'completed'`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND lease_id IN (
                    SELECT id FROM leases WHERE landlord_id = $${params.length + 1}
                  )`;
        params.push(landlordId);
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

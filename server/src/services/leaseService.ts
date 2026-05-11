import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface LeaseInput {
  tenantId: string;
  propertyId: string;
  landlordId: string;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  depositAmount: number;
  terms?: string;
  renewalType?: 'fixed' | 'automatic' | 'none';
}

export class LeaseService {
  /**
   * Create new lease
   */
  static async createLease(input: LeaseInput) {
    try {
      const leaseId = uuidv4();
      const result = await pool.query(
        `INSERT INTO leases (
          id, tenant_id, property_id, landlord_id, start_date, end_date,
          rent_amount, deposit_amount, terms, renewal_type, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [
          leaseId,
          input.tenantId,
          input.propertyId,
          input.landlordId,
          input.startDate,
          input.endDate,
          input.rentAmount,
          input.depositAmount,
          input.terms || '',
          input.renewalType || 'none',
          'draft',
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get lease by ID
   */
  static async getLeaseById(leaseId: string) {
    try {
      const result = await pool.query(
        `SELECT l.*, p.title as property_title, p.address, 
                u.email as tenant_email, u.first_name as tenant_first_name, u.last_name as tenant_last_name,
                l2.email as landlord_email, l2.first_name as landlord_first_name, l2.last_name as landlord_last_name
         FROM leases l
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON l.tenant_id = u.id
         JOIN users l2 ON l.landlord_id = l2.id
         WHERE l.id = $1`,
        [leaseId]
      );

      if (result.rows.length === 0) {
        throw new Error('Lease not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all leases with filters
   */
  static async getAllLeases(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (filters?.status) {
        whereClause += ` AND l.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.tenantId) {
        whereClause += ` AND l.tenant_id = $${params.length + 1}`;
        params.push(filters.tenantId);
      }

      if (filters?.landlordId) {
        whereClause += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(filters.landlordId);
      }

      if (filters?.propertyId) {
        whereClause += ` AND l.property_id = $${params.length + 1}`;
        params.push(filters.propertyId);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM leases l ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT l.id, l.tenant_id, l.property_id, l.start_date, l.end_date, 
                l.rent_amount, l.status, l.created_at,
                p.title, u.first_name, u.last_name, u.email
         FROM leases l
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON l.tenant_id = u.id
         ${whereClause}
         ORDER BY l.created_at DESC
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
   * Update lease
   */
  static async updateLease(leaseId: string, updates: any) {
    try {
      const allowedFields = ['start_date', 'end_date', 'rent_amount', 'deposit_amount', 'terms', 'renewal_type'];
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        return this.getLeaseById(leaseId);
      }

      values.push(leaseId);
      const query = `UPDATE leases SET ${setClause.join(', ')}, updated_at = NOW()
                     WHERE id = $${paramIndex}
                     RETURNING *`;

      await pool.query(query, values);
      return this.getLeaseById(leaseId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sign lease (digital signature)
   */
  static async signLease(leaseId: string, signedByUserId: string, role: 'tenant' | 'landlord') {
    try {
      const lease = await this.getLeaseById(leaseId);

      if (role === 'tenant' && lease.tenant_id !== signedByUserId) {
        throw new Error('Only tenant can sign as tenant');
      }

      if (role === 'landlord' && lease.landlord_id !== signedByUserId) {
        throw new Error('Only landlord can sign as landlord');
      }

      const column = role === 'tenant' ? 'tenant_signed_at' : 'landlord_signed_at';

      await pool.query(
        `UPDATE leases SET ${column} = NOW(), updated_at = NOW() WHERE id = $1`,
        [leaseId]
      );

      // Check if both signed
      const result = await pool.query(
        'SELECT tenant_signed_at, landlord_signed_at FROM leases WHERE id = $1',
        [leaseId]
      );

      const updated = result.rows[0];
      if (updated.tenant_signed_at && updated.landlord_signed_at) {
        // Both signed, activate lease
        await pool.query(
          `UPDATE leases SET status = 'active', activated_at = NOW() WHERE id = $1`,
          [leaseId]
        );

        // Update property status to occupied
        await pool.query(
          `UPDATE properties SET status = 'occupied' WHERE id = $1`,
          [lease.property_id]
        );
      }

      return this.getLeaseById(leaseId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Terminate lease
   */
  static async terminateLease(leaseId: string, terminationReason: string, terminationDate: Date) {
    try {
      const result = await pool.query(
        `UPDATE leases SET status = $1, termination_reason = $2, termination_date = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        ['terminated', terminationReason, terminationDate, leaseId]
      );

      // Update property status back to available
      const lease = result.rows[0];
      await pool.query('UPDATE properties SET status = $1 WHERE id = $2', ['available', lease.property_id]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Renew lease
   */
  static async renewLease(leaseId: string, renewalInput: Partial<LeaseInput>) {
    try {
      const newLeaseId = uuidv4();
      const lease = await this.getLeaseById(leaseId);

      const result = await pool.query(
        `INSERT INTO leases (
          id, tenant_id, property_id, landlord_id, start_date, end_date,
          rent_amount, deposit_amount, terms, renewal_type, status, previous_lease_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          newLeaseId,
          lease.tenant_id,
          lease.property_id,
          lease.landlord_id,
          renewalInput.startDate || new Date(),
          renewalInput.endDate,
          renewalInput.rentAmount || lease.rent_amount,
          renewalInput.depositAmount || lease.deposit_amount,
          renewalInput.terms || lease.terms,
          renewalInput.renewalType || lease.renewal_type,
          'draft',
          leaseId,
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant leases
   */
  static async getTenantLeases(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT l.id, l.property_id, l.start_date, l.end_date, l.rent_amount, l.status,
                p.title, p.address
         FROM leases l
         JOIN properties p ON l.property_id = p.id
         WHERE l.tenant_id = $1
         ORDER BY l.start_date DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get landlord leases
   */
  static async getLandlordLeases(landlordId: string) {
    try {
      const result = await pool.query(
        `SELECT l.id, l.tenant_id, l.property_id, l.start_date, l.end_date, l.rent_amount, l.status,
                p.title, u.email, u.first_name, u.last_name
         FROM leases l
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON l.tenant_id = u.id
         WHERE l.landlord_id = $1
         ORDER BY l.start_date DESC`,
        [landlordId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get lease statistics
   */
  static async getLeaseStats(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_leases,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_leases,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_leases,
                    SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated_leases,
                    SUM(rent_amount) as total_monthly_revenue
                   FROM leases WHERE 1=1`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get active leases expiring soon
   */
  static async getLeasesExpiringWithin(days: number = 30) {
    try {
      const result = await pool.query(
        `SELECT l.id, l.tenant_id, l.property_id, l.end_date, p.title,
                u.email, u.first_name, u.last_name, l2.email as landlord_email
         FROM leases l
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON l.tenant_id = u.id
         JOIN users l2 ON l.landlord_id = l2.id
         WHERE l.status = 'active' 
         AND l.end_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
         ORDER BY l.end_date ASC`,
        []
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

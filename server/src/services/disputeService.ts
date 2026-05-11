import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface DisputeInput {
  leaseId: string;
  initiatorId: string;
  initiatorRole: 'tenant' | 'landlord';
  title: string;
  description: string;
  category: string;
  claimedAmount?: number;
}

interface DisputeResolutionInput {
  resolvedBy: string;
  resolution: string;
  settlement?: number;
}

export class DisputeService {
  /**
   * Create dispute
   */
  static async createDispute(input: DisputeInput) {
    try {
      const disputeId = uuidv4();
      const result = await pool.query(
        `INSERT INTO disputes (
          id, lease_id, initiator_id, initiator_role, title, description, 
          category, claimed_amount, priority, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *`,
        [
          disputeId,
          input.leaseId,
          input.initiatorId,
          input.initiatorRole,
          input.title,
          input.description,
          input.category,
          input.claimedAmount || 0,
          'medium',
          'open',
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dispute by ID
   */
  static async getDisputeById(disputeId: string) {
    try {
      const result = await pool.query(
        `SELECT d.*, p.title as property_title, p.address,
                u1.email as initiator_email, u1.first_name as initiator_first_name,
                u2.email as respondent_email, u2.first_name as respondent_first_name
         FROM disputes d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         JOIN users u1 ON d.initiator_id = u1.id
         LEFT JOIN users u2 ON (CASE 
           WHEN d.initiator_role = 'tenant' THEN l.landlord_id 
           ELSE l.tenant_id 
         END) = u2.id
         WHERE d.id = $1`,
        [disputeId]
      );

      if (result.rows.length === 0) {
        throw new Error('Dispute not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all disputes with filters
   */
  static async getAllDisputes(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (filters?.status) {
        whereClause += ` AND d.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.priority) {
        whereClause += ` AND d.priority = $${params.length + 1}`;
        params.push(filters.priority);
      }

      if (filters?.category) {
        whereClause += ` AND d.category = $${params.length + 1}`;
        params.push(filters.category);
      }

      if (filters?.leaseId) {
        whereClause += ` AND d.lease_id = $${params.length + 1}`;
        params.push(filters.leaseId);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM disputes d ${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT d.id, d.title, d.status, d.priority, d.category, d.claimed_amount, d.created_at,
                u.first_name, u.last_name, p.title as property_title
         FROM disputes d
         JOIN users u ON d.initiator_id = u.id
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         ${whereClause}
         ORDER BY d.priority DESC, d.created_at DESC
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
   * Update dispute
   */
  static async updateDispute(disputeId: string, updates: any) {
    try {
      const allowedFields = ['title', 'description', 'category', 'claimed_amount', 'priority'];
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
        return this.getDisputeById(disputeId);
      }

      values.push(disputeId);
      const query = `UPDATE disputes SET ${setClause.join(', ')}, updated_at = NOW()
                     WHERE id = $${paramIndex}
                     RETURNING *`;

      await pool.query(query, values);
      return this.getDisputeById(disputeId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resolve dispute
   */
  static async resolveDispute(disputeId: string, input: DisputeResolutionInput) {
    try {
      const result = await pool.query(
        `UPDATE disputes SET status = $1, resolution = $2, settlement_amount = $3, 
                resolved_by = $4, resolved_at = NOW(), updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        ['resolved', input.resolution, input.settlement || 0, input.resolvedBy, disputeId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Appeal dispute
   */
  static async appealDispute(disputeId: string, appealReason: string) {
    try {
      const result = await pool.query(
        `UPDATE disputes SET status = $1, appeal_reason = $2, appealed_at = NOW(), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        ['appealed', appealReason, disputeId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add dispute comment/response
   */
  static async addDisputeComment(disputeId: string, userId: string, comment: string) {
    try {
      const commentId = uuidv4();
      const result = await pool.query(
        `INSERT INTO dispute_comments (id, dispute_id, user_id, comment, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [commentId, disputeId, userId, comment]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dispute comments
   */
  static async getDisputeComments(disputeId: string) {
    try {
      const result = await pool.query(
        `SELECT dc.id, dc.comment, dc.created_at, u.first_name, u.last_name, u.email
         FROM dispute_comments dc
         JOIN users u ON dc.user_id = u.id
         WHERE dc.dispute_id = $1
         ORDER BY dc.created_at ASC`,
        [disputeId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant disputes
   */
  static async getTenantDisputes(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT d.id, d.title, d.status, d.priority, d.claimed_amount, d.created_at,
                p.title as property_title
         FROM disputes d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         WHERE l.tenant_id = $1
         ORDER BY d.created_at DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get landlord disputes
   */
  static async getLandlordDisputes(landlordId: string) {
    try {
      const result = await pool.query(
        `SELECT d.id, d.title, d.status, d.priority, d.claimed_amount, d.created_at,
                p.title as property_title, u.first_name, u.last_name
         FROM disputes d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON d.initiator_id = u.id
         WHERE l.landlord_id = $1
         ORDER BY d.priority DESC, d.created_at DESC`,
        [landlordId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dispute statistics
   */
  static async getDisputeStats(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_disputes,
                    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_disputes,
                    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_disputes,
                    SUM(CASE WHEN status = 'appealed' THEN 1 ELSE 0 END) as appealed_disputes,
                    SUM(claimed_amount) as total_claimed,
                    SUM(CASE WHEN settlement_amount > 0 THEN settlement_amount ELSE 0 END) as total_settled
                   FROM disputes WHERE 1=1`;
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

  /**
   * Get pending disputes
   */
  static async getPendingDisputes() {
    try {
      const result = await pool.query(
        `SELECT d.id, d.title, d.priority, d.claimed_amount, d.created_at,
                p.title as property_title, u1.first_name as tenant_first_name,
                u2.first_name as landlord_first_name
         FROM disputes d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         JOIN users u1 ON l.tenant_id = u1.id
         JOIN users u2 ON l.landlord_id = u2.id
         WHERE d.status = 'open'
         ORDER BY d.priority DESC, d.created_at ASC`
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dispute timeline
   */
  static async getDisputeTimeline(disputeId: string) {
    try {
      const result = await pool.query(
        `SELECT 
          'created' as event, created_at as event_time, NULL as user_id
         FROM disputes
         WHERE id = $1
         UNION ALL
         SELECT 
          'comment' as event, created_at as event_time, user_id
         FROM dispute_comments
         WHERE dispute_id = $1
         UNION ALL
         SELECT 
          'resolved' as event, resolved_at as event_time, resolved_by as user_id
         FROM disputes
         WHERE id = $1 AND status = 'resolved'
         ORDER BY event_time ASC`,
        [disputeId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dispute categories
   */
  static async getDisputeCategories() {
    const categories = [
      'Rent Payment',
      'Deposit',
      'Maintenance',
      'Property Damage',
      'Lease Violation',
      'Security',
      'Other',
    ];
    return categories;
  }

  /**
   * Close dispute
   */
  static async closeDispute(disputeId: string) {
    try {
      const result = await pool.query(
        `UPDATE disputes SET status = $1, closed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        ['closed', disputeId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

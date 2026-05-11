import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface MaintenanceRequestInput {
  leaseId: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  photos?: string[];
}

export class MaintenanceService {
  /**
   * Create maintenance request
   */
  static async createMaintenanceRequest(input: MaintenanceRequestInput) {
    try {
      const requestId = uuidv4();
      const result = await pool.query(
        `INSERT INTO maintenance_requests (
          id, lease_id, tenant_id, title, description, category, priority, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [requestId, input.leaseId, input.tenantId, input.title, input.description, input.category, input.priority, 'pending']
      );

      // Upload photos if provided
      if (input.photos && input.photos.length > 0) {
        for (const photoUrl of input.photos) {
          await this.uploadRequestPhoto(requestId, photoUrl);
        }
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get maintenance request by ID
   */
  static async getMaintenanceRequestById(requestId: string) {
    try {
      const result = await pool.query(
        `SELECT mr.*, l.rent_amount, p.title as property_title, p.address,
                u.email, u.first_name, u.last_name, l2.email as landlord_email
         FROM maintenance_requests mr
         JOIN leases l ON mr.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON mr.tenant_id = u.id
         JOIN users l2 ON l.landlord_id = l2.id
         WHERE mr.id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Maintenance request not found');
      }

      // Fetch photos
      const photosResult = await pool.query(
        'SELECT id, photo_url FROM maintenance_photos WHERE request_id = $1',
        [requestId]
      );

      return {
        ...result.rows[0],
        photos: photosResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all maintenance requests with filters
   */
  static async getAllMaintenanceRequests(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (filters?.status) {
        whereClause += ` AND mr.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.priority) {
        whereClause += ` AND mr.priority = $${params.length + 1}`;
        params.push(filters.priority);
      }

      if (filters?.tenantId) {
        whereClause += ` AND mr.tenant_id = $${params.length + 1}`;
        params.push(filters.tenantId);
      }

      if (filters?.landlordId) {
        whereClause += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(filters.landlordId);
      }

      if (filters?.category) {
        whereClause += ` AND mr.category = $${params.length + 1}`;
        params.push(filters.category);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM maintenance_requests mr JOIN leases l ON mr.lease_id = l.id ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT mr.id, mr.title, mr.priority, mr.status, mr.created_at, mr.category,
                u.first_name, u.last_name, p.title as property_title
         FROM maintenance_requests mr
         JOIN leases l ON mr.lease_id = l.id
         JOIN users u ON mr.tenant_id = u.id
         JOIN properties p ON l.property_id = p.id
         ${whereClause}
         ORDER BY mr.priority DESC, mr.created_at DESC
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
   * Update maintenance request status
   */
  static async updateMaintenanceStatus(requestId: string, status: string, notes?: string) {
    try {
      const updateData: any = [status, requestId];
      let query = `UPDATE maintenance_requests SET status = $1, updated_at = NOW()`;

      if (notes) {
        query += `, landlord_notes = $${updateData.length + 1}`;
        updateData.push(notes);
      }

      if (status === 'completed') {
        query += `, completed_at = NOW()`;
      }

      query += ` WHERE id = $${updateData.length + 1} RETURNING *`;
      updateData.push(requestId);

      const result = await pool.query(query, updateData);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Assign maintenance to technician (optional)
   */
  static async assignMaintenanceRequest(requestId: string, assignedToUserId?: string) {
    try {
      const result = await pool.query(
        `UPDATE maintenance_requests SET assigned_to = $1, status = 'assigned', updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [assignedToUserId || null, requestId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload maintenance photo
   */
  static async uploadRequestPhoto(requestId: string, photoUrl: string) {
    try {
      const photoId = uuidv4();
      const result = await pool.query(
        `INSERT INTO maintenance_photos (id, request_id, photo_url)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [photoId, requestId, photoUrl]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant maintenance requests
   */
  static async getTenantMaintenanceRequests(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT mr.id, mr.title, mr.priority, mr.status, mr.category, mr.created_at, mr.updated_at,
                p.title as property_title
         FROM maintenance_requests mr
         JOIN leases l ON mr.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         WHERE mr.tenant_id = $1
         ORDER BY mr.created_at DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get landlord maintenance requests
   */
  static async getLandlordMaintenanceRequests(landlordId: string) {
    try {
      const result = await pool.query(
        `SELECT mr.id, mr.title, mr.priority, mr.status, mr.category, mr.created_at, mr.updated_at,
                p.title as property_title, u.email, u.first_name, u.last_name
         FROM maintenance_requests mr
         JOIN leases l ON mr.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         JOIN users u ON mr.tenant_id = u.id
         WHERE l.landlord_id = $1
         ORDER BY mr.priority DESC, mr.created_at DESC`,
        [landlordId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get maintenance statistics
   */
  static async getMaintenanceStats(landlordId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
                    SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_requests,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_requests,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
                    SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_requests
                   FROM maintenance_requests mr
                   JOIN leases l ON mr.lease_id = l.id
                   WHERE 1=1`;
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
   * Get urgent maintenance requests
   */
  static async getUrgentMaintenanceRequests(landlordId?: string) {
    try {
      let query = `SELECT mr.id, mr.title, mr.priority, mr.category, mr.created_at,
                          p.title as property_title, u.first_name, u.last_name
                   FROM maintenance_requests mr
                   JOIN leases l ON mr.lease_id = l.id
                   JOIN properties p ON l.property_id = p.id
                   JOIN users u ON mr.tenant_id = u.id
                   WHERE mr.priority = 'urgent' AND mr.status != 'completed'`;
      const params: any[] = [];

      if (landlordId) {
        query += ` AND l.landlord_id = $${params.length + 1}`;
        params.push(landlordId);
      }

      query += ` ORDER BY mr.created_at ASC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get maintenance request tracking
   */
  static async getMaintenanceTracking(requestId: string) {
    try {
      const result = await pool.query(
        `SELECT 
          mr.id, mr.title, mr.status, mr.priority, mr.created_at, mr.updated_at,
          mr.completed_at, EXTRACT(DAY FROM mr.updated_at - mr.created_at) as response_time_days
         FROM maintenance_requests mr
         WHERE mr.id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Maintenance request not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get maintenance categories
   */
  static async getMaintenanceCategories() {
    const categories = [
      'Plumbing',
      'Electrical',
      'HVAC',
      'Appliances',
      'Flooring',
      'Walls & Paint',
      'Windows & Doors',
      'Roofing',
      'Landscaping',
      'Other',
    ];
    return categories;
  }

  /**
   * Delete maintenance request (soft delete)
   */
  static async deleteMaintenanceRequest(requestId: string) {
    try {
      await pool.query(
        'UPDATE maintenance_requests SET deleted_at = NOW() WHERE id = $1',
        [requestId]
      );
      return { success: true, message: 'Maintenance request deleted' };
    } catch (error) {
      throw error;
    }
  }
}

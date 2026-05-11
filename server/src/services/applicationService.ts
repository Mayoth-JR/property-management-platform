import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface ApplicationInput {
  tenantId: string;
  propertyId: string;
  coverLetter: string;
  employmentStatus: string;
  employerName?: string;
  monthlyIncome: number;
  referenceName?: string;
  referencePhone?: string;
}

export class ApplicationService {
  /**
   * Create property application
   */
  static async createApplication(input: ApplicationInput) {
    try {
      // Check if already applied
      const existing = await pool.query(
        `SELECT id FROM applications 
         WHERE tenant_id = $1 AND property_id = $2 AND status != 'rejected'`,
        [input.tenantId, input.propertyId]
      );

      if (existing.rows.length > 0) {
        throw new Error('You have already applied for this property');
      }

      const applicationId = uuidv4();
      
      // Calculate approval score
      const score = await this.calculateApprovalScore(input);

      const result = await pool.query(
        `INSERT INTO applications (
          id, tenant_id, property_id, cover_letter, employment_status, 
          employer_name, monthly_income, reference_name, reference_phone,
          approval_score, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [
          applicationId,
          input.tenantId,
          input.propertyId,
          input.coverLetter,
          input.employmentStatus,
          input.employerName || null,
          input.monthlyIncome,
          input.referenceName || null,
          input.referencePhone || null,
          score,
          'pending',
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate approval score
   */
  static async calculateApprovalScore(input: ApplicationInput): Promise<number> {
    try {
      let score = 50; // Base score

      // Employment status scoring
      if (input.employmentStatus === 'employed') {
        score += 30;
      } else if (input.employmentStatus === 'self-employed') {
        score += 20;
      } else if (input.employmentStatus === 'unemployed') {
        score -= 20;
      }

      // Income vs rent ratio
      const propertyResult = await pool.query(
        'SELECT rent_price FROM properties WHERE id = $1',
        [input.propertyId]
      );

      if (propertyResult.rows.length > 0) {
        const rentPrice = propertyResult.rows[0].rent_price;
        const incomeRatio = input.monthlyIncome / rentPrice;

        if (incomeRatio >= 3) {
          score += 20;
        } else if (incomeRatio >= 2.5) {
          score += 15;
        } else if (incomeRatio >= 2) {
          score += 10;
        } else if (incomeRatio < 1.5) {
          score -= 15;
        }
      }

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(applicationId: string) {
    try {
      const result = await pool.query(
        `SELECT a.*, p.title, p.address, p.rent_price, u.email, u.first_name, u.last_name
         FROM applications a
         JOIN properties p ON a.property_id = p.id
         JOIN users u ON a.tenant_id = u.id
         WHERE a.id = $1`,
        [applicationId]
      );

      if (result.rows.length === 0) {
        throw new Error('Application not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all applications with filters
   */
  static async getAllApplications(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (filters?.status) {
        whereClause += ` AND a.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.propertyId) {
        whereClause += ` AND a.property_id = $${params.length + 1}`;
        params.push(filters.propertyId);
      }

      if (filters?.tenantId) {
        whereClause += ` AND a.tenant_id = $${params.length + 1}`;
        params.push(filters.tenantId);
      }

      if (filters?.landlordId) {
        whereClause += ` AND p.landlord_id = $${params.length + 1}`;
        params.push(filters.landlordId);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM applications a JOIN properties p ON a.property_id = p.id ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT a.id, a.tenant_id, a.property_id, a.status, a.approval_score, 
                a.monthly_income, a.created_at, a.updated_at, p.title, p.address,
                u.email, u.first_name, u.last_name
         FROM applications a
         JOIN properties p ON a.property_id = p.id
         JOIN users u ON a.tenant_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
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
   * Approve application
   */
  static async approveApplication(applicationId: string, approvalNotes?: string) {
    try {
      const app = await this.getApplicationById(applicationId);

      // Update application status
      await pool.query(
        `UPDATE applications SET status = $1, approval_notes = $2, approved_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        ['approved', approvalNotes || '', applicationId]
      );

      // Create lease draft
      const leaseId = uuidv4();
      await pool.query(
        `INSERT INTO leases (id, tenant_id, property_id, landlord_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [leaseId, app.tenant_id, app.property_id, app.landlord_id, 'draft']
      );

      return this.getApplicationById(applicationId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reject application
   */
  static async rejectApplication(applicationId: string, rejectionReason: string) {
    try {
      const result = await pool.query(
        `UPDATE applications SET status = $1, rejection_reason = $2, rejected_at = NOW(), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        ['rejected', rejectionReason, applicationId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tenant applications
   */
  static async getTenantApplications(tenantId: string) {
    try {
      const result = await pool.query(
        `SELECT a.id, a.property_id, a.status, a.approval_score, a.created_at, 
                a.updated_at, p.title, p.address, p.city, p.rent_price
         FROM applications a
         JOIN properties p ON a.property_id = p.id
         WHERE a.tenant_id = $1
         ORDER BY a.created_at DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get property applications
   */
  static async getPropertyApplications(propertyId: string, status?: string) {
    try {
      let query = `SELECT a.id, a.tenant_id, a.status, a.approval_score, a.monthly_income, 
                          a.employment_status, a.created_at, u.email, u.first_name, u.last_name
                   FROM applications a
                   JOIN users u ON a.tenant_id = u.id
                   WHERE a.property_id = $1`;
      const params: any[] = [propertyId];

      if (status) {
        query += ` AND a.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY a.approval_score DESC, a.created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(propertyId?: string) {
    try {
      let query = `SELECT 
                    COUNT(*) as total_applications,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_applications,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_applications,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_applications,
                    AVG(approval_score) as average_approval_score
                   FROM applications WHERE 1=1`;
      const params: any[] = [];

      if (propertyId) {
        query += ` AND property_id = $${params.length + 1}`;
        params.push(propertyId);
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload application document
   */
  static async uploadApplicationDocument(applicationId: string, documentUrl: string, documentType: string) {
    try {
      const docId = uuidv4();
      const result = await pool.query(
        `INSERT INTO application_documents (id, application_id, document_url, document_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [docId, applicationId, documentUrl, documentType]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get application documents
   */
  static async getApplicationDocuments(applicationId: string) {
    try {
      const result = await pool.query(
        `SELECT id, document_url, document_type, created_at FROM application_documents
         WHERE application_id = $1`,
        [applicationId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete application document
   */
  static async deleteApplicationDocument(docId: string) {
    try {
      await pool.query('DELETE FROM application_documents WHERE id = $1', [docId]);
      return { success: true, message: 'Document deleted' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(applicationId: string, status: string) {
    try {
      const result = await pool.query(
        `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, applicationId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

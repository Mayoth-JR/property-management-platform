import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface PropertyInput {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: 'apartment' | 'house' | 'commercial' | 'land';
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  rentPrice: number;
  depositPrice: number;
  amenities: string[];
  petFriendly: boolean;
  furnished: boolean;
  landlordId: string;
}

export class PropertyService {
  /**
   * Create new property
   */
  static async createProperty(input: PropertyInput) {
    try {
      const propertyId = uuidv4();
      const result = await pool.query(
        `INSERT INTO properties (
          id, landlord_id, title, description, address, city, state, zip_code,
          property_type, bedrooms, bathrooms, square_feet, rent_price, deposit_price,
          amenities, pet_friendly, furnished, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        RETURNING *`,
        [
          propertyId,
          input.landlordId,
          input.title,
          input.description,
          input.address,
          input.city,
          input.state,
          input.zipCode,
          input.propertyType,
          input.bedrooms,
          input.bathrooms,
          input.squareFeet,
          input.rentPrice,
          input.depositPrice,
          JSON.stringify(input.amenities),
          input.petFriendly,
          input.furnished,
          'available',
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get property by ID with images and documents
   */
  static async getPropertyById(propertyId: string) {
    try {
      const propertyResult = await pool.query(
        `SELECT * FROM properties WHERE id = $1 AND deleted_at IS NULL`,
        [propertyId]
      );

      if (propertyResult.rows.length === 0) {
        throw new Error('Property not found');
      }

      const property = propertyResult.rows[0];

      // Fetch images
      const imagesResult = await pool.query(
        'SELECT id, image_url, is_primary FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC',
        [propertyId]
      );

      // Fetch documents
      const docsResult = await pool.query(
        'SELECT id, document_name, document_url, document_type FROM property_documents WHERE property_id = $1',
        [propertyId]
      );

      return {
        ...property,
        amenities: property.amenities ? JSON.parse(property.amenities) : [],
        images: imagesResult.rows,
        documents: docsResult.rows,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all properties with filtering and pagination
   */
  static async getAllProperties(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE deleted_at IS NULL';
      const params = [];

      if (filters?.status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.landlordId) {
        whereClause += ` AND landlord_id = $${params.length + 1}`;
        params.push(filters.landlordId);
      }

      if (filters?.propertyType) {
        whereClause += ` AND property_type = $${params.length + 1}`;
        params.push(filters.propertyType);
      }

      if (filters?.city) {
        whereClause += ` AND city ILIKE $${params.length + 1}`;
        params.push(`%${filters.city}%`);
      }

      if (filters?.minRent && filters?.maxRent) {
        whereClause += ` AND rent_price BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(filters.minRent, filters.maxRent);
      }

      if (filters?.minBeds) {
        whereClause += ` AND bedrooms >= $${params.length + 1}`;
        params.push(filters.minBeds);
      }

      if (filters?.search) {
        whereClause += ` AND (title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
        params.push(`%${filters.search}%`);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM properties ${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT p.id, p.title, p.address, p.city, p.rent_price, p.bedrooms, 
                p.bathrooms, p.square_feet, p.status, p.created_at,
                (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) as primary_image
         FROM properties p ${whereClause}
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
   * Update property
   */
  static async updateProperty(propertyId: string, updates: any) {
    try {
      const allowedFields = [
        'title',
        'description',
        'address',
        'city',
        'state',
        'zip_code',
        'bedrooms',
        'bathrooms',
        'square_feet',
        'rent_price',
        'deposit_price',
        'amenities',
        'pet_friendly',
        'furnished',
        'status',
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'amenities' && Array.isArray(value)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        return this.getPropertyById(propertyId);
      }

      values.push(propertyId);
      const query = `UPDATE properties SET ${setClause.join(', ')}, updated_at = NOW()
                     WHERE id = $${paramIndex} AND deleted_at IS NULL
                     RETURNING *`;

      await pool.query(query, values);
      return this.getPropertyById(propertyId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete property (soft delete)
   */
  static async deleteProperty(propertyId: string) {
    try {
      await pool.query('UPDATE properties SET deleted_at = NOW() WHERE id = $1', [propertyId]);
      return { success: true, message: 'Property deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload property image
   */
  static async uploadPropertyImage(propertyId: string, imageUrl: string, isPrimary = false) {
    try {
      // If this is primary, remove primary status from other images
      if (isPrimary) {
        await pool.query('UPDATE property_images SET is_primary = false WHERE property_id = $1', [propertyId]);
      }

      const imageId = uuidv4();
      const result = await pool.query(
        `INSERT INTO property_images (id, property_id, image_url, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [imageId, propertyId, imageUrl, isPrimary]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get property images
   */
  static async getPropertyImages(propertyId: string) {
    try {
      const result = await pool.query(
        'SELECT id, image_url, is_primary FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC',
        [propertyId]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete property image
   */
  static async deletePropertyImage(imageId: string) {
    try {
      await pool.query('DELETE FROM property_images WHERE id = $1', [imageId]);
      return { success: true, message: 'Image deleted' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload property document
   */
  static async uploadPropertyDocument(
    propertyId: string,
    documentName: string,
    documentUrl: string,
    documentType: string
  ) {
    try {
      const docId = uuidv4();
      const result = await pool.query(
        `INSERT INTO property_documents (id, property_id, document_name, document_url, document_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [docId, propertyId, documentName, documentUrl, documentType]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get property documents
   */
  static async getPropertyDocuments(propertyId: string) {
    try {
      const result = await pool.query(
        'SELECT id, document_name, document_url, document_type FROM property_documents WHERE property_id = $1',
        [propertyId]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete property document
   */
  static async deletePropertyDocument(docId: string) {
    try {
      await pool.query('DELETE FROM property_documents WHERE id = $1', [docId]);
      return { success: true, message: 'Document deleted' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get landlord properties
   */
  static async getLandlordProperties(landlordId: string) {
    try {
      const result = await pool.query(
        `SELECT id, title, address, city, rent_price, bedrooms, status, created_at FROM properties
         WHERE landlord_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [landlordId]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get property statistics
   */
  static async getPropertyStats(landlordId: string) {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_properties,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_properties,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_properties,
          AVG(rent_price) as average_rent,
          SUM(rent_price) as total_monthly_revenue
         FROM properties
         WHERE landlord_id = $1 AND deleted_at IS NULL`,
        [landlordId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search properties with advanced filters
   */
  static async searchProperties(query: string, filters?: any) {
    try {
      let sql = `SELECT id, title, address, city, rent_price, bedrooms, bathrooms, square_feet, status
                FROM properties WHERE deleted_at IS NULL AND (
                  title ILIKE $1 OR description ILIKE $1 OR address ILIKE $1 OR city ILIKE $1
                )`;
      const params: any[] = [`%${query}%`];

      if (filters?.propertyType) {
        sql += ` AND property_type = $${params.length + 1}`;
        params.push(filters.propertyType);
      }

      if (filters?.minPrice && filters?.maxPrice) {
        sql += ` AND rent_price BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(filters.minPrice, filters.maxPrice);
      }

      if (filters?.bedrooms) {
        sql += ` AND bedrooms >= $${params.length + 1}`;
        params.push(filters.bedrooms);
      }

      sql += ` LIMIT 50`;

      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

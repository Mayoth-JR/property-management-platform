import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';

interface UserPayload {
  id: string;
  email: string;
  role: 'admin' | 'landlord' | 'tenant';
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'admin' | 'landlord' | 'tenant';
}

interface LoginInput {
  email: string;
  password: string;
}

export class UserService {
  /**
   * Register a new user
   */
  static async register(input: RegisterInput) {
    try {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [input.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const userId = uuidv4();
      const result = await pool.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role, email_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, role, created_at`,
        [
          userId,
          input.email,
          hashedPassword,
          input.firstName,
          input.lastName,
          input.phoneNumber,
          input.role,
          false,
          'active',
        ]
      );

      // Create user profile
      await pool.query(
        `INSERT INTO user_profiles (user_id, bio, profile_picture_url)
         VALUES ($1, $2, $3)`,
        [userId, '', null]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(input: LoginInput) {
    try {
      const result = await pool.query(
        'SELECT id, email, password_hash, role, status FROM users WHERE email = $1 AND deleted_at IS NULL',
        [input.email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      if (user.status !== 'active') {
        throw new Error('Account is inactive');
      }

      // Update last login
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // Generate tokens
      const tokens = this.generateTokens(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        tokens,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate JWT tokens (access + refresh)
   */
  static generateTokens(user: UserPayload) {
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify and refresh token
   */
  static async refreshToken(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as UserPayload;

      // Fetch user from DB
      const result = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL',
        [payload.id]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Generate OTP
   */
  static async generateOTP(userId: string, email: string) {
    try {
      const otp = Math.random().toString().slice(2, 8); // 6-digit OTP
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await pool.query(
        `INSERT INTO otp_tokens (user_id, otp, email, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $4`,
        [userId, otp, email, expiresAt]
      );

      return { otp, expiresAt };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(email: string, otp: string) {
    try {
      const result = await pool.query(
        `SELECT user_id FROM otp_tokens 
         WHERE email = $1 AND otp = $2 AND expires_at > NOW()`,
        [email, otp]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid or expired OTP');
      }

      // Delete OTP after verification
      await pool.query('DELETE FROM otp_tokens WHERE email = $1', [email]);

      return { userId: result.rows[0].user_id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string) {
    try {
      const result = await pool.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone_number, u.role, 
                u.created_at, u.last_login_at, up.bio, up.profile_picture_url, up.national_id,
                up.date_of_birth, up.annual_income, up.credit_score, up.verified_at
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: any) {
    try {
      const allowedFields = ['first_name', 'last_name', 'phone_number'];
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
        return this.getUserProfile(userId);
      }

      values.push(userId);
      const query = `UPDATE users SET ${setClause.join(', ')}, updated_at = NOW() 
                     WHERE id = $${paramIndex} AND deleted_at IS NULL
                     RETURNING *`;

      await pool.query(query, values);
      return this.getUserProfile(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user extended profile
   */
  static async updateExtendedProfile(userId: string, profileData: any) {
    try {
      const allowedFields = ['bio', 'profile_picture_url', 'national_id', 'date_of_birth', 'annual_income'];
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(profileData)) {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      values.push(userId);
      const query = `UPDATE user_profiles SET ${setClause.join(', ')}, verified_at = NOW()
                     WHERE user_id = $${paramIndex}
                     RETURNING *`;

      await pool.query(query, values);
      return this.getUserProfile(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all users (Admin only)
   */
  static async getAllUsers(filters?: any, pagination?: any) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE deleted_at IS NULL';
      const params = [];

      if (filters?.role) {
        whereClause += ` AND role = $${params.length + 1}`;
        params.push(filters.role);
      }

      if (filters?.status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.search) {
        whereClause += ` AND (email ILIKE $${params.length + 1} OR first_name ILIKE $${params.length + 1})`;
        params.push(`%${filters.search}%`);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, status, created_at, last_login_at
         FROM users ${whereClause}
         ORDER BY created_at DESC
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
   * Delete user (soft delete)
   */
  static async deleteUser(userId: string) {
    try {
      await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user status (Admin only)
   */
  static async updateUserStatus(userId: string, status: 'active' | 'suspended' | 'deactivated') {
    try {
      await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);
      return this.getUserProfile(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify email
   */
  static async verifyEmail(userId: string) {
    try {
      await pool.query(
        'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1',
        [userId]
      );
      return { success: true, message: 'Email verified' };
    } catch (error) {
      throw error;
    }
  }
}

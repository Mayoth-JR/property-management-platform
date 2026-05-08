import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { query } from '../config/database';
import { AppError } from '../middlewares/errorMiddleware';
import { v4 as uuidv4 } from 'uuid';

export interface UserPayload {
  id: string;
  email: string;
  role: 'admin' | 'landlord' | 'tenant';
}

export const userService = {
  async createUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'admin' | 'landlord' | 'tenant' = 'tenant',
    phone?: string
  ) {
    // Check if user exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      throw new AppError(409, 'User already exists', 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, role, phone_number, verification_token, verification_token_expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, role, first_name, last_name`,
      [email, passwordHash, firstName, lastName, role, phone, verificationToken, verificationExpiry]
    );

    return result.rows[0];
  },

  async authenticateUser(email: string, password: string) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };
  },

  async generateTokens(user: UserPayload) {
    const accessToken = jwt.sign(user, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    const refreshToken = jwt.sign(user, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    });

    return { accessToken, refreshToken };
  },

  async verifyRefreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as UserPayload;
      return decoded;
    } catch (err) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  },

  async getUserById(userId: string) {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.phone_number, u.avatar_url, u.is_active, u.created_at, 
              up.bio, up.city, up.country, up.date_of_birth 
       FROM users u 
       LEFT JOIN user_profiles up ON u.id = up.user_id 
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return result.rows[0];
  },

  async updateUserProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string;
    }
  ) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.firstName) {
      setClauses.push(`first_name = $${paramIndex}`);
      values.push(updates.firstName);
      paramIndex++;
    }
    if (updates.lastName) {
      setClauses.push(`last_name = $${paramIndex}`);
      values.push(updates.lastName);
      paramIndex++;
    }
    if (updates.phone) {
      setClauses.push(`phone_number = $${paramIndex}`);
      values.push(updates.phone);
      paramIndex++;
    }
    if (updates.avatarUrl) {
      setClauses.push(`avatar_url = $${paramIndex}`);
      values.push(updates.avatarUrl);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return await this.getUserById(userId);
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  },

  async deleteUser(userId: string) {
    await query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1',
      [userId]
    );
  },

  async generateOTP(userId: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE id = $3',
      [otp, otpExpiry, userId]
    );

    return otp;
  },

  async verifyOTP(userId: string, otp: string) {
    const result = await query(
      `SELECT id, otp_expires_at FROM users 
       WHERE id = $1 AND otp = $2 AND otp_expires_at > CURRENT_TIMESTAMP`,
      [userId, otp]
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    }

    // Clear OTP after verification
    await query('UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = $1', [userId]);

    return true;
  },
};

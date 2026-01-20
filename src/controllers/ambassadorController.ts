import { Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiResponse,
  Ambassador,
  CreateAmbassadorRequest,
  UpdateAmbassadorRequest,
  PaginatedResponse,
  AmbassadorFilters,
} from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

const generateReferralCode = (name: string): string => {
  const namePart = name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `AMB-${namePart}${year}${random}`;
};

const generatePassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const getAmbassadors = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      page = 1,
      limit = 20,
    } = req.query as unknown as AmbassadorFilters;

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let query = 'SELECT * FROM ambassadors WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM ambassadors WHERE 1=1';

    if (search) {
      query += ' AND (name ILIKE $' + (params.length + 1) + ' OR email ILIKE $' + (params.length + 1) + ' OR referral_code ILIKE $' + (params.length + 1) + ')';
      countQuery += ' AND (name ILIKE $' + (params.length + 1) + ' OR email ILIKE $' + (params.length + 1) + ' OR referral_code ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    if (status) {
      query += ' AND status = $' + (params.length + 1);
      countQuery += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<Ambassador> = {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Get ambassadors error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ambassadors' });
  }
};

export const createAmbassador = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { name, email, phone, social_media, notes } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, error: 'Name, email, and phone are required' });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM ambassadors WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    // Check max ambassadors
    const maxResult = await pool.query(
      "SELECT value FROM settings WHERE key = 'max_ambassadors'"
    );
    const maxAmbassadors = parseInt(maxResult.rows[0]?.value || '50', 10);

    const countResult = await pool.query('SELECT COUNT(*) as count FROM ambassadors');
    const currentCount = parseInt(countResult.rows[0].count, 10);

    if (currentCount >= maxAmbassadors) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${maxAmbassadors} ambassadors allowed`,
      });
    }

    // Generate referral code (ensure uniqueness)
    let referralCode = generateReferralCode(name);
    let codeExists = true;
    while (codeExists) {
      const check = await pool.query('SELECT id FROM ambassadors WHERE referral_code = $1', [referralCode]);
      if (check.rows.length === 0) {
        codeExists = false;
      } else {
        referralCode = generateReferralCode(name + Math.random().toString());
      }
    }

    // Generate password
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert ambassador
    const id = uuidv4();
    await pool.query(
      `INSERT INTO ambassadors (
        id, name, email, phone, password_hash, referral_code, social_media, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        name,
        email,
        phone,
        passwordHash,
        referralCode,
        JSON.stringify(social_media || {}),
        notes || null,
        'active',
      ]
    );

    const result = await pool.query('SELECT * FROM ambassadors WHERE id = $1', [id]);

    res.status(201).json({
      success: true,
      data: {
        ambassador: result.rows[0],
        password,
      },
      message: 'Ambassador created successfully',
    });
  } catch (error) {
    console.error('Create ambassador error:', error);
    res.status(500).json({ success: false, error: 'Failed to create ambassador' });
  }
};

export const getAmbassador = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM ambassadors WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get ambassador error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ambassador' });
  }
};

export const updateAmbassador = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const updates: UpdateAmbassadorRequest = req.body;

    // Check if ambassador exists
    const existing = await pool.query('SELECT id FROM ambassadors WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    // Check email uniqueness if email is being updated
    if (updates.email) {
      const emailCheck = await pool.query(
        'SELECT id FROM ambassadors WHERE email = $1 AND id != $2',
        [updates.email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Email already exists' });
      }
    }

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.email) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.phone) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.social_media) {
      fields.push(`social_media = $${paramIndex++}`);
      values.push(JSON.stringify(updates.social_media));
    }
    if (updates.target_referrals !== undefined) {
      fields.push(`target_referrals = $${paramIndex++}`);
      values.push(updates.target_referrals);
    }
    if (updates.target_points !== undefined) {
      fields.push(`target_points = $${paramIndex++}`);
      values.push(updates.target_points);
    }
    if (updates.kpi_notes !== undefined) {
      fields.push(`kpi_notes = $${paramIndex++}`);
      values.push(updates.kpi_notes);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE ambassadors SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM ambassadors WHERE id = $1', [id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update ambassador error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ambassador' });
  }
};

export const deleteAmbassador = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete - set status to inactive
    await pool.query(
      "UPDATE ambassadors SET status = 'inactive', updated_at = NOW() WHERE id = $1",
      [id]
    );

    res.json({ success: true, message: 'Ambassador deactivated successfully' });
  } catch (error) {
    console.error('Delete ambassador error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete ambassador' });
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query('UPDATE ambassadors SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      id,
    ]);

    res.json({
      success: true,
      data: { password },
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};


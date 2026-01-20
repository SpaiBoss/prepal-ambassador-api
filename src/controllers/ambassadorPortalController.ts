import { Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import {
  ApiResponse,
  AmbassadorDashboard,
  UpdateProfileRequest,
  ChangePasswordRequest,
  PaginatedResponse,
} from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;

    // Get ambassador info with KPIs
    const ambassadorResult = await pool.query(
      'SELECT referral_code, total_referrals, total_points_earned, points_balance, target_referrals, target_points, kpi_notes FROM ambassadors WHERE id = $1',
      [ambassadorId]
    );

    if (ambassadorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    const ambassador = ambassadorResult.rows[0];

    // Get referrals this month
    const thisMonthResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(points_awarded), 0) as points
       FROM referrals 
       WHERE ambassador_id = $1 
       AND registered_at >= date_trunc('month', CURRENT_DATE)`,
      [ambassadorId]
    );

    // Get general targets from settings
    const generalTargetsResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('general_target_referrals', 'general_target_points')`
    );

    const generalTargets: Record<string, number> = {};
    generalTargetsResult.rows.forEach((row) => {
      generalTargets[row.key] = parseInt(row.value || '0', 10);
    });

    const dashboard: AmbassadorDashboard = {
      referral_code: ambassador.referral_code,
      total_referrals: ambassador.total_referrals,
      total_points_earned: ambassador.total_points_earned,
      points_balance: ambassador.points_balance,
      referrals_this_month: parseInt(thisMonthResult.rows[0].count, 10),
      points_this_month: parseInt(thisMonthResult.rows[0].points, 10),
      target_referrals: ambassador.target_referrals || null,
      target_points: ambassador.target_points || null,
      kpi_notes: ambassador.kpi_notes || null,
      general_target_referrals: generalTargets.general_target_referrals || 0,
      general_target_points: generalTargets.general_target_points || 0,
    };

    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Get ambassador dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
};

export const getReferrals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const { status, search } = req.query;

    const offset = (page - 1) * limit;
    const params: any[] = [ambassadorId];
    let query = 'SELECT * FROM referrals WHERE ambassador_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM referrals WHERE ambassador_id = $1';

    if (status) {
      query += ' AND status = $' + (params.length + 1);
      countQuery += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (search) {
      const searchParam = `%${search}%`;
      query += ' AND (student_name ILIKE $' + (params.length + 1) + ' OR student_email ILIKE $' + (params.length + 1) + ')';
      countQuery += ' AND (student_name ILIKE $' + (params.length + 1) + ' OR student_email ILIKE $' + (params.length + 1) + ')';
      params.push(searchParam);
    }

    query += ' ORDER BY registered_at DESC';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<any> = {
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Get ambassador referrals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referrals' });
  }
};

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '10'), 10);
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        'SELECT * FROM payouts WHERE ambassador_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [ambassadorId, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM payouts WHERE ambassador_id = $1', [ambassadorId]),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<any> = {
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Get ambassador payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;

    const result = await pool.query(
      'SELECT id, name, email, phone, referral_code, social_media, joined_at FROM ambassadors WHERE id = $1',
      [ambassadorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get ambassador profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;
    const { name, phone, social_media } = req.body;

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (phone) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }

    if (social_media) {
      fields.push(`social_media = $${paramIndex++}`);
      values.push(JSON.stringify(social_media));
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(ambassadorId);

    await pool.query(
      `UPDATE ambassadors SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query(
      'SELECT id, name, email, phone, referral_code, social_media, joined_at FROM ambassadors WHERE id = $1',
      [ambassadorId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update ambassador profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== 'ambassador') {
      return res.status(403).json({ success: false, error: 'Ambassador access required' });
    }

    const ambassadorId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters',
      });
    }

    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM ambassadors WHERE id = $1',
      [ambassadorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE ambassadors SET password_hash = $1 WHERE id = $2', [
      newPasswordHash,
      ambassadorId,
    ]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
};


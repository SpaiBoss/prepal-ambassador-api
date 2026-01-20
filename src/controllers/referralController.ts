import { Response } from 'express';
import pool from '../config/database.js';
import {
  ApiResponse,
  Referral,
  PaginatedResponse,
  ReferralFilters,
} from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      ambassadorId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query as unknown as ReferralFilters;

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let query = `
      SELECT r.*, a.name as ambassador_name 
      FROM referrals r
      LEFT JOIN ambassadors a ON r.ambassador_id = a.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM referrals WHERE 1=1';

    if (search) {
      const searchParam = `%${search}%`;
      query += ' AND (r.student_name ILIKE $' + (params.length + 1) + ' OR r.student_email ILIKE $' + (params.length + 1) + ')';
      countQuery += ' AND (student_name ILIKE $' + (params.length + 1) + ' OR student_email ILIKE $' + (params.length + 1) + ')';
      params.push(searchParam);
    }

    if (ambassadorId) {
      query += ' AND r.ambassador_id = $' + (params.length + 1);
      countQuery += ' AND ambassador_id = $' + (params.length + 1);
      params.push(ambassadorId);
    }

    if (status) {
      query += ' AND r.status = $' + (params.length + 1);
      countQuery += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (startDate) {
      query += ' AND r.registered_at >= $' + (params.length + 1);
      countQuery += ' AND registered_at >= $' + (params.length + 1);
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND r.registered_at <= $' + (params.length + 1);
      countQuery += ' AND registered_at <= $' + (params.length + 1);
      params.push(endDate);
    }

    query += ' ORDER BY r.registered_at DESC';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<Referral & { ambassador_name?: string }> = {
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
    console.error('Get referrals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referrals' });
  }
};

export const getReferralsByAmbassador = async (req: AuthRequest, res: Response) => {
  try {
    const { ambassadorId } = req.params;
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);

    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        'SELECT * FROM referrals WHERE ambassador_id = $1 ORDER BY registered_at DESC LIMIT $2 OFFSET $3',
        [ambassadorId, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM referrals WHERE ambassador_id = $1', [ambassadorId]),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<Referral> = {
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
    console.error('Get referrals by ambassador error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referrals' });
  }
};

export const updateReferral = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status is required' });
    }

    const result = await pool.query(
      'UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Referral not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update referral error:', error);
    res.status(500).json({ success: false, error: 'Failed to update referral' });
  }
};


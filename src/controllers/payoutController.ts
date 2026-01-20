import { Response } from 'express';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiResponse,
  Payout,
  CreatePayoutRequest,
  PaginatedResponse,
  PayoutFilters,
} from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      ambassadorId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query as unknown as PayoutFilters;

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let query = `
      SELECT p.*, a.name as ambassador_name 
      FROM payouts p
      LEFT JOIN ambassadors a ON p.ambassador_id = a.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM payouts WHERE 1=1';

    if (ambassadorId) {
      query += ' AND p.ambassador_id = $' + (params.length + 1);
      countQuery += ' AND ambassador_id = $' + (params.length + 1);
      params.push(ambassadorId);
    }

    if (status) {
      query += ' AND p.status = $' + (params.length + 1);
      countQuery += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (startDate) {
      query += ' AND p.created_at >= $' + (params.length + 1);
      countQuery += ' AND created_at >= $' + (params.length + 1);
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND p.created_at <= $' + (params.length + 1);
      countQuery += ' AND created_at <= $' + (params.length + 1);
      params.push(endDate);
    }

    query += ' ORDER BY p.created_at DESC';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse<Payout & { ambassador_name?: string }> = {
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
    console.error('Get payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payouts' });
  }
};

export const getPendingPayouts = async (req: AuthRequest, res: Response) => {
  try {
    // Get ambassadors with points balance > 0
    const result = await pool.query(
      `SELECT 
        id, name, email, phone, referral_code, points_balance
      FROM ambassadors 
      WHERE points_balance > 0 AND status = 'active'
      ORDER BY points_balance DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get pending payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending payouts' });
  }
};

export const createPayout = async (
  req: AuthRequest,
  res: Response
) => {
  const client = await pool.connect();

  try {
    const { ambassadorId, amount, payment_method, phone_number, transaction_reference, notes } =
      req.body;

    if (!ambassadorId || !amount || !payment_method || !phone_number) {
      return res.status(400).json({
        success: false,
        error: 'ambassadorId, amount, payment_method, and phone_number are required',
      });
    }

    if (!['MTN', 'ORANGE'].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        error: 'payment_method must be MTN or ORANGE',
      });
    }

    // Check ambassador exists and has sufficient points
    const ambassadorResult = await client.query(
      'SELECT id, name, points_balance FROM ambassadors WHERE id = $1',
      [ambassadorId]
    );

    if (ambassadorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ambassador not found' });
    }

    const ambassador = ambassadorResult.rows[0];

    if (ambassador.points_balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient points balance',
      });
    }

    // Start transaction
    await client.query('BEGIN');

    try {
      // Create payout record (initially pending)
      const payoutId = uuidv4();
      await client.query(
        `INSERT INTO payouts (
          id, ambassador_id, amount, points_deducted, payment_method, 
          phone_number, status, transaction_reference, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          payoutId,
          ambassadorId,
          amount,
          amount, // points_deducted equals amount (1 point = 1 FCFA)
          payment_method,
          phone_number,
          'pending', // Start as pending - admin will mark as completed after manual transfer
          transaction_reference || null,
          notes || null,
        ]
      );

      // Deduct points from ambassador balance
      await client.query(
        `UPDATE ambassadors 
         SET points_balance = points_balance - $1, updated_at = NOW()
         WHERE id = $2`,
        [amount, ambassadorId]
      );

      await client.query('COMMIT');

      const payoutResult = await client.query('SELECT * FROM payouts WHERE id = $1', [payoutId]);

      res.status(201).json({
        success: true,
        data: payoutResult.rows[0],
        message: 'Payout recorded successfully. Please mark as completed after manual transfer.',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payout' });
  } finally {
    client.release();
  }
};

export const updatePayout = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, transaction_reference, notes } = req.body;

    // Check if payout exists
    const existing = await pool.query('SELECT * FROM payouts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payout not found' });
    }

    const payout = existing.rows[0];

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      if (!['pending', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      fields.push(`status = $${paramIndex++}`);
      values.push(status);

      // If marking as completed, set processed_at
      if (status === 'completed' && !payout.processed_at) {
        fields.push(`processed_at = NOW()`);
      }

      // If marking as failed, restore points
      if (status === 'failed' && payout.status === 'pending') {
        await pool.query(
          `UPDATE ambassadors 
           SET points_balance = points_balance + $1, updated_at = NOW()
           WHERE id = $2`,
          [payout.points_deducted, payout.ambassador_id]
        );
      }
    }

    if (transaction_reference !== undefined) {
      fields.push(`transaction_reference = $${paramIndex++}`);
      values.push(transaction_reference);
    }

    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);

    await pool.query(
      `UPDATE payouts SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM payouts WHERE id = $1', [id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update payout error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payout' });
  }
};


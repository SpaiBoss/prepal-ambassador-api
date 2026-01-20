import { Response } from 'express';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

const convertToCSV = (rows: any[], headers: string[]): string => {
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

export const exportAmbassadors = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT name, email, phone, referral_code, total_referrals, total_points_earned, points_balance, status, joined_at FROM ambassadors ORDER BY created_at DESC'
    );

    const headers = [
      'Name',
      'Email',
      'Phone',
      'Referral Code',
      'Total Referrals',
      'Total Points Earned',
      'Points Balance',
      'Status',
      'Joined At',
    ];

    const csv = convertToCSV(result.rows, headers.map((h) => h.toLowerCase().replace(/\s+/g, '_')));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ambassadors.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export ambassadors error:', error);
    res.status(500).json({ success: false, error: 'Failed to export ambassadors' });
  }
};

export const exportReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.student_name,
        r.student_email,
        r.student_id,
        a.name as ambassador_name,
        r.ambassador_code,
        r.subscription_plan,
        r.subscription_price,
        r.points_awarded,
        r.status,
        r.registered_at
      FROM referrals r
      LEFT JOIN ambassadors a ON r.ambassador_id = a.id
      ORDER BY r.registered_at DESC
    `);

    const headers = [
      'student_name',
      'student_email',
      'student_id',
      'ambassador_name',
      'ambassador_code',
      'subscription_plan',
      'subscription_price',
      'points_awarded',
      'status',
      'registered_at',
    ];

    const csv = convertToCSV(result.rows, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=referrals.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export referrals error:', error);
    res.status(500).json({ success: false, error: 'Failed to export referrals' });
  }
};

export const exportPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.name as ambassador_name,
        p.amount,
        p.points_deducted,
        p.payment_method,
        p.phone_number,
        p.status,
        p.transaction_reference,
        p.created_at,
        p.processed_at
      FROM payouts p
      LEFT JOIN ambassadors a ON p.ambassador_id = a.id
      ORDER BY p.created_at DESC
    `);

    const headers = [
      'ambassador_name',
      'amount',
      'points_deducted',
      'payment_method',
      'phone_number',
      'status',
      'transaction_reference',
      'created_at',
      'processed_at',
    ];

    const csv = convertToCSV(result.rows, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payouts.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to export payouts' });
  }
};


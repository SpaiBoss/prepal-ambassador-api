import { Response } from 'express';
import pool from '../config/database.js';
import { ApiResponse, LeaderboardResponse } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'all', page = 1, limit = 20 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "AND r.registered_at >= date_trunc('month', CURRENT_DATE)";
    }

    // Count total ambassadors for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM ambassadors a
      LEFT JOIN referrals r ON a.id = r.ambassador_id ${dateFilter}
      WHERE a.status = 'active'
    `;

    // Top by referrals
    const referralsQuery = `
      SELECT 
        a.id as ambassador_id,
        a.name as ambassador_name,
        a.referral_code,
        COUNT(r.id) as total_referrals,
        COALESCE(SUM(r.points_awarded), 0) as total_points
      FROM ambassadors a
      LEFT JOIN referrals r ON a.id = r.ambassador_id ${dateFilter}
      WHERE a.status = 'active'
      GROUP BY a.id, a.name, a.referral_code
      ORDER BY total_referrals DESC, total_points DESC
      LIMIT $1 OFFSET $2
    `;

    // Top by points
    const pointsQuery = `
      SELECT 
        a.id as ambassador_id,
        a.name as ambassador_name,
        a.referral_code,
        COUNT(r.id) as total_referrals,
        COALESCE(SUM(r.points_awarded), 0) as total_points
      FROM ambassadors a
      LEFT JOIN referrals r ON a.id = r.ambassador_id ${dateFilter}
      WHERE a.status = 'active'
      GROUP BY a.id, a.name, a.referral_code
      ORDER BY total_points DESC, total_referrals DESC
      LIMIT $1 OFFSET $2
    `;

    const [countResult, referralsResult, pointsResult] = await Promise.all([
      pool.query(countQuery),
      pool.query(referralsQuery, [limitNum, offset]),
      pool.query(pointsQuery, [limitNum, offset]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    const byReferrals = referralsResult.rows.map((row, index) => ({
      ...row,
      rank: offset + index + 1,
      total_referrals: parseInt(row.total_referrals, 10),
      total_points: parseInt(row.total_points, 10),
    }));

    const byPoints = pointsResult.rows.map((row, index) => ({
      ...row,
      rank: offset + index + 1,
      total_referrals: parseInt(row.total_referrals, 10),
      total_points: parseInt(row.total_points, 10),
    }));

    const response: LeaderboardResponse = {
      byReferrals,
      byPoints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
};


import { Response } from 'express';
import pool from '../config/database.js';
import { ApiResponse, DashboardStats } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const client = await pool.connect();

    try {
      // Total ambassadors
      const ambassadorsResult = await client.query(
        'SELECT COUNT(*) as count FROM ambassadors'
      );
      const totalAmbassadors = parseInt(ambassadorsResult.rows[0].count, 10);

      // Max ambassadors from settings
      const maxResult = await client.query(
        "SELECT value FROM settings WHERE key = 'max_ambassadors'"
      );
      const maxAmbassadors = parseInt(maxResult.rows[0]?.value || '50', 10);

      // Total referrals
      const totalReferralsResult = await client.query(
        'SELECT COUNT(*) as count FROM referrals'
      );
      const totalReferrals = parseInt(totalReferralsResult.rows[0].count, 10);

      // Referrals this month
      const thisMonthResult = await client.query(
        `SELECT COUNT(*) as count FROM referrals 
         WHERE registered_at >= date_trunc('month', CURRENT_DATE)`
      );
      const referralsThisMonth = parseInt(thisMonthResult.rows[0].count, 10);

      // Referrals last month
      const lastMonthResult = await client.query(
        `SELECT COUNT(*) as count FROM referrals 
         WHERE registered_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
         AND registered_at < date_trunc('month', CURRENT_DATE)`
      );
      const referralsLastMonth = parseInt(lastMonthResult.rows[0].count, 10);

      // Total points owed (sum of all points balances)
      const pointsResult = await client.query(
        'SELECT COALESCE(SUM(points_balance), 0) as total FROM ambassadors'
      );
      const totalPointsOwed = parseInt(pointsResult.rows[0].total, 10);

      // Pending payouts count
      const pendingPayoutsResult = await client.query(
        "SELECT COUNT(*) as count FROM payouts WHERE status = 'pending'"
      );
      const pendingPayoutsCount = parseInt(pendingPayoutsResult.rows[0].count, 10);

      const stats: DashboardStats = {
        totalAmbassadors,
        maxAmbassadors,
        totalReferrals,
        referralsThisMonth,
        referralsLastMonth,
        totalPointsOwed,
        pendingPayoutsCount,
      };

      // Get referrals over last 6 months for chart
      const referralsOverTimeResult = await client.query(`
        SELECT 
          TO_CHAR(registered_at, 'YYYY-MM') as month,
          COUNT(*) as count
        FROM referrals
        WHERE registered_at >= date_trunc('month', CURRENT_DATE - INTERVAL '6 months')
        GROUP BY TO_CHAR(registered_at, 'YYYY-MM')
        ORDER BY month ASC
      `);

      const referralsOverTime = referralsOverTimeResult.rows.map((row) => ({
        month: row.month,
        referrals: parseInt(row.count, 10),
      }));

      res.json({ success: true, data: { ...stats, referralsOverTime } });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
};


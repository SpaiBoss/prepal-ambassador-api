import { Response } from 'express';
import pool from '../config/database.js';
import { ApiResponse, UpdateSettingsRequest } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');

    const settings: Record<string, any> = {};
    result.rows.forEach((row) => {
      let value: any = row.value;
      // Parse boolean and number values
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value))) value = Number(value);
      settings[row.key] = value;
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const updates = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.points_per_referral !== undefined) {
        await client.query(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'points_per_referral'",
          [updates.points_per_referral.toString()]
        );
      }

      if (updates.max_ambassadors !== undefined) {
        await client.query(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'max_ambassadors'",
          [updates.max_ambassadors.toString()]
        );
      }

      if (updates.system_active !== undefined) {
        await client.query(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'system_active'",
          [updates.system_active.toString()]
        );
      }

      if (updates.general_target_referrals !== undefined) {
        await client.query(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'general_target_referrals'",
          [updates.general_target_referrals.toString()]
        );
      }

      if (updates.general_target_points !== undefined) {
        await client.query(
          "UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'general_target_points'",
          [updates.general_target_points.toString()]
        );
      }

      await client.query('COMMIT');

      // Return updated settings
      const result = await pool.query('SELECT key, value FROM settings');
      const settings: Record<string, any> = {};
      result.rows.forEach((row) => {
        let value: any = row.value;
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(Number(value))) value = Number(value);
        settings[row.key] = value;
      });

      res.json({ success: true, data: settings, message: 'Settings updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};


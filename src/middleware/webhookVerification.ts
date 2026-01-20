import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';

export const verifyWebhookSecret = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for X-Security-Code header (Prepal format) or x-webhook-secret (legacy)
    const providedSecret = (req.headers['x-security-code'] || req.headers['x-webhook-secret']) as string;

    if (!providedSecret) {
      return res.status(401).json({ success: false, error: 'Webhook secret required' });
    }

    // 1. Try environment variable first (preferred for Render)
    let storedSecret = process.env.WEBHOOK_SECRET;

    // 2. Fallback to database settings
    if (!storedSecret) {
      const result = await pool.query(
        "SELECT value FROM settings WHERE key = 'webhook_secret'"
      );
      if (result.rows.length > 0) {
        storedSecret = result.rows[0].value;
      }
    }

    if (!storedSecret) {
      return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
    }

    if (providedSecret !== storedSecret) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }

    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};


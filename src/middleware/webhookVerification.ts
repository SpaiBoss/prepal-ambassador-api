import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';

export const verifyWebhookSecret = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for various possible header names for the secret
    const providedSecret = (
      req.headers['x-webhook-secret'] ||
      req.headers['x-security-code'] ||
      req.headers['authorization']
    ) as string;

    console.log('[Webhook Debug] Received Headers:', JSON.stringify(req.headers));

    if (!providedSecret) {
      console.error('[Webhook Debug] No secret provided in headers');
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
      console.error('[Webhook Debug] Secret mismatch. Provided:', providedSecret.substring(0, 4) + '***', 'Expected:', storedSecret.substring(0, 4) + '***');
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }

    console.log('[Webhook Debug] Secret verified successfully');

    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};


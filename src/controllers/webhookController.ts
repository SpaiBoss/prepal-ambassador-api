import { Request, Response } from 'express';
import pool from '../config/database.js';
import { WebhookPayload, WebhookResponse } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Prepal webhook payload format
interface PrepalWebhookPayload {
  name: string;
  email: string;
  referer: string;
  date: string;
}

export const handleNewStudent = async (
  req: Request<{}, WebhookResponse, WebhookPayload | PrepalWebhookPayload>,
  res: Response
) => {
  const client = await pool.connect();

  try {
    console.log('[Webhook Debug] Incoming Body:', JSON.stringify(req.body));
    // Support both Prepal format and legacy format
    let studentName: string;
    let studentEmail: string;
    let studentId: string;
    let plan: string;
    let price: number;
    let referralCode: string;
    let registeredAt: string;

    // Check if this is Prepal format (has 'name', 'email', 'referer', 'date')
    if ('name' in req.body && 'email' in req.body && 'referer' in req.body) {
      const prepalPayload = req.body as PrepalWebhookPayload;

      // Validate Prepal required fields
      if (!prepalPayload.name || !prepalPayload.email || !prepalPayload.referer) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, email, referer',
        });
      }

      // Map Prepal format to internal format
      studentName = prepalPayload.name;
      studentEmail = prepalPayload.email;
      referralCode = prepalPayload.referer;
      registeredAt = prepalPayload.date || new Date().toISOString();

      // Generate studentId from email (hash for uniqueness)
      studentId = crypto.createHash('sha256').update(prepalPayload.email).digest('hex').substring(0, 32);

      // Use defaults for plan and price (can be configured later)
      plan = 'Standard';
      price = 0;
    } else {
      // Legacy format
      const legacyPayload = req.body as WebhookPayload;
      studentName = legacyPayload.studentName;
      studentEmail = legacyPayload.studentEmail;
      studentId = legacyPayload.studentId;
      plan = legacyPayload.plan;
      price = legacyPayload.price;
      referralCode = legacyPayload.referralCode;
      registeredAt = legacyPayload.registeredAt;

      // Validate legacy required fields
      if (!studentName || !studentEmail || !studentId || !plan || !referralCode) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: studentName, studentEmail, studentId, plan, referralCode',
        });
      }
    }

    // Check if system is active
    const systemCheck = await client.query(
      "SELECT value FROM settings WHERE key = 'system_active'"
    );
    if (systemCheck.rows[0]?.value !== 'true') {
      return res.status(503).json({
        success: false,
        error: 'System is currently inactive',
      });
    }

    // Check for duplicate referral (same student_id or email)
    const duplicateCheck = await client.query(
      'SELECT id FROM referrals WHERE student_id = $1 OR student_email = $2',
      [studentId, studentEmail]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Student already registered',
      });
    }

    // Find ambassador by referral code
    const ambassadorResult = await client.query(
      'SELECT id, name, status FROM ambassadors WHERE referral_code = $1',
      [referralCode]
    );

    if (ambassadorResult.rows.length === 0) {
      console.error('[Webhook Debug] No ambassador found for code:', referralCode);
      return res.status(404).json({
        success: false,
        error: 'Invalid referral code',
      });
    }

    const ambassador = ambassadorResult.rows[0];
    console.log('[Webhook Debug] Ambassador found:', ambassador.name, '(ID:', ambassador.id, ')');

    // Check if ambassador is active
    if (ambassador.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Ambassador account is not active',
      });
    }

    // Get points per referral setting
    const pointsResult = await client.query(
      "SELECT value FROM settings WHERE key = 'points_per_referral'"
    );
    const pointsPerReferral = parseInt(pointsResult.rows[0]?.value || '1000', 10);

    // Start transaction
    await client.query('BEGIN');

    try {
      // Create referral record
      const referralId = uuidv4();
      await client.query(
        `INSERT INTO referrals (
          id, student_name, student_email, student_id, ambassador_id, ambassador_code,
          subscription_plan, subscription_price, points_awarded, status, registered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          referralId,
          studentName,
          studentEmail,
          studentId,
          ambassador.id,
          referralCode,
          plan,
          price,
          pointsPerReferral,
          'active',
          registeredAt ? new Date(registeredAt) : new Date(),
        ]
      );

      // Update ambassador stats
      await client.query(
        `UPDATE ambassadors 
         SET total_referrals = total_referrals + 1,
             total_points_earned = total_points_earned + $1,
             points_balance = points_balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [pointsPerReferral, ambassador.id]
      );

      await client.query('COMMIT');

      console.log(`Referral recorded: ${studentName} (${studentEmail}) for ambassador ${ambassador.name}`);

      res.json({
        success: true,
        message: 'Referral recorded',
        pointsAwarded: pointsPerReferral,
        ambassadorName: ambassador.name,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process referral',
    });
  } finally {
    client.release();
  }
};


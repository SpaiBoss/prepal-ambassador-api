import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { handleNewStudent } from '../controllers/webhookController.js';
import { verifyWebhookSecret } from '../middleware/webhookVerification.js';

const router = Router();

// Rate limiting: max 10 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many webhook requests, please try again later.',
});

router.post('/referral', webhookLimiter, verifyWebhookSecret, handleNewStudent);

export default router;


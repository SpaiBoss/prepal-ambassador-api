import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getPayouts,
  getPendingPayouts,
  createPayout,
  updatePayout,
} from '../controllers/payoutController.js';

const router = Router();

// All payout routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

router.get('/', getPayouts);
router.get('/pending', getPendingPayouts);
router.post('/', createPayout);
router.put('/:id', updatePayout);

export default router;


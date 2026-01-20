import { Router } from 'express';
import { authenticate, requireAmbassador } from '../middleware/auth.js';
import {
  getDashboard,
  getReferrals,
  getPayments,
  getProfile,
  updateProfile,
  changePassword,
} from '../controllers/ambassadorPortalController.js';

const router = Router();

// All ambassador routes require authentication and ambassador role
router.use(authenticate);
router.use(requireAmbassador);

router.get('/dashboard', getDashboard);
router.get('/referrals', getReferrals);
router.get('/payments', getPayments);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

export default router;


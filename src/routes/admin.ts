import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboardController.js';
import {
  getAmbassadors,
  createAmbassador,
  getAmbassador,
  updateAmbassador,
  deleteAmbassador,
  resetPassword,
} from '../controllers/ambassadorController.js';
import {
  getReferrals,
  getReferralsByAmbassador,
  updateReferral,
} from '../controllers/referralController.js';
import { getLeaderboard } from '../controllers/leaderboardController.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import {
  exportAmbassadors,
  exportReferrals,
  exportPayouts,
} from '../controllers/exportController.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard-stats', getDashboardStats);

// Ambassadors
router.get('/ambassadors', getAmbassadors);
router.post('/ambassadors', createAmbassador);
router.get('/ambassadors/:id', getAmbassador);
router.put('/ambassadors/:id', updateAmbassador);
router.delete('/ambassadors/:id', deleteAmbassador);
router.post('/ambassadors/:id/reset-password', resetPassword);

// Referrals
router.get('/referrals', getReferrals);
router.get('/referrals/ambassador/:ambassadorId', getReferralsByAmbassador);
router.put('/referrals/:id', updateReferral);

// Leaderboard
router.get('/leaderboard', getLeaderboard);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Exports
router.get('/export/ambassadors', exportAmbassadors);
router.get('/export/referrals', exportReferrals);
router.get('/export/payouts', exportPayouts);

export default router;


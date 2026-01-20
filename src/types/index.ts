// Database entity types
export interface Ambassador {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  referral_code: string;
  total_referrals: number;
  total_points_earned: number;
  points_balance: number;
  status: 'active' | 'inactive' | 'suspended';
  social_media: {
    tiktok?: string;
    facebook?: string;
    instagram?: string;
  };
  target_referrals?: number;
  target_points?: number;
  kpi_notes?: string;
  joined_at: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Referral {
  id: string;
  student_name: string;
  student_email: string;
  student_id: string;
  ambassador_id: string | null;
  ambassador_code: string;
  subscription_plan: string;
  subscription_price: number;
  points_awarded: number;
  status: 'active' | 'cancelled';
  registered_at: Date;
  created_at: Date;
}

export interface Payout {
  id: string;
  ambassador_id: string | null;
  amount: number;
  points_deducted: number;
  payment_method: 'MTN' | 'ORANGE';
  phone_number: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_reference?: string;
  notes?: string;
  processed_at?: Date;
  created_at: Date;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: Date;
}

// Webhook types
export interface WebhookPayload {
  studentName: string;
  studentEmail: string;
  studentId: string;
  plan: string;
  price: number;
  referralCode: string;
  registeredAt: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  pointsAwarded?: number;
  ambassadorName?: string;
  error?: string;
}

// API Request/Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard stats
export interface DashboardStats {
  totalAmbassadors: number;
  maxAmbassadors: number;
  totalReferrals: number;
  referralsThisMonth: number;
  referralsLastMonth: number;
  totalPointsOwed: number;
  pendingPayoutsCount: number;
  referralsOverTime?: Array<{ month: string; referrals: number }>;
}

// Filter types
export interface AmbassadorFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
  page?: number;
  limit?: number;
}

export interface ReferralFilters {
  search?: string;
  ambassadorId?: string;
  status?: 'active' | 'cancelled';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PayoutFilters {
  ambassadorId?: string;
  status?: 'pending' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'ambassador';
    referralCode?: string;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'ambassador';
}

// Ambassador creation/update
export interface CreateAmbassadorRequest {
  name: string;
  email: string;
  phone: string;
  social_media?: {
    tiktok?: string;
    facebook?: string;
    instagram?: string;
  };
  notes?: string;
}

export interface UpdateAmbassadorRequest {
  name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  social_media?: {
    tiktok?: string;
    facebook?: string;
    instagram?: string;
  };
  target_referrals?: number;
  target_points?: number;
  kpi_notes?: string;
  notes?: string;
}

// Payout creation
export interface CreatePayoutRequest {
  ambassadorId: string;
  amount: number;
  payment_method: 'MTN' | 'ORANGE';
  phone_number: string;
  transaction_reference?: string;
  notes?: string;
}

// Settings
export interface UpdateSettingsRequest {
  points_per_referral?: number;
  max_ambassadors?: number;
  system_active?: boolean;
  general_target_referrals?: number;
  general_target_points?: number;
}

// Ambassador Portal
export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  social_media?: {
    tiktok?: string;
    facebook?: string;
    instagram?: string;
  };
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Ambassador Dashboard
export interface AmbassadorDashboard {
  referral_code: string;
  total_referrals: number;
  total_points_earned: number;
  points_balance: number;
  referrals_this_month: number;
  points_this_month: number;
  target_referrals?: number | null;
  target_points?: number | null;
  kpi_notes?: string | null;
  general_target_referrals?: number;
  general_target_points?: number;
}

// Leaderboard
export interface LeaderboardEntry {
  ambassador_id: string;
  ambassador_name: string;
  referral_code: string;
  total_referrals: number;
  total_points: number;
  rank: number;
}

export interface LeaderboardResponse {
  byReferrals: LeaderboardEntry[];
  byPoints: LeaderboardEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


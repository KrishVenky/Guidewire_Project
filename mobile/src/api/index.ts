import api from './config';

// Types
export interface Worker {
  id: string;
  full_name: string;
  phone: string;
  upi_id: string;
  platform: 'ZOMATO' | 'SWIGGY' | 'BLINKIT' | 'INSTAMART';
  zone_id: string;
  avg_weekly_income: number;
  declared_weekly_hours: number;
  trust_tier: 'NEW_PARTNER' | 'RISING_PARTNER' | 'TRUSTED_PARTNER';
}

export interface Policy {
  id: string;
  worker_id: string;
  weekly_premium: number;
  coverage_amount: number;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  total_payouts_received: number;
}

export interface Claim {
  id: string;
  status: 'AUTO_APPROVED' | 'MANUAL_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
  payout_amount: number;
  fraud_flags: string[];
  llm_explanation: string;
  created_at: string;
}

export interface Disruption {
  id: string;
  event_type: 'HEAVY_RAIN' | 'EXTREME_HEAT' | 'HIGH_AQI' | 'NDMA_ALERT' | 'BANDH';
  severity_score: number;
  started_at: string;
  ended_at: string;
}

// Auth APIs
export const authAPI = {
  requestOTP: async (phone: string) => {
    const res = await api.post('/api/auth/request-otp', { phone });
    return res.data;
  },
  verifyOTP: async (phone: string, otp: string) => {
    const res = await api.post('/api/auth/verify-otp', { phone, otp });
    return res.data;
  },
  adminLogin: async (pin: string) => {
    const res = await api.post('/api/auth/admin-login', { pin });
    return res.data;
  },
};

// Worker APIs
export const workerAPI = {
  register: async (data: Partial<Worker>) => {
    const res = await api.post('/api/workers/register', data);
    return res.data;
  },
  getDashboard: async (workerId: string) => {
    const res = await api.get(`/api/workers/${workerId}/dashboard`);
    return res.data;
  },
};

// Policy APIs
export const policyAPI = {
  create: async (workerId: string) => {
    const res = await api.post('/api/policies/create', { worker_id: workerId });
    return res.data;
  },
  getWorkerPolicies: async (workerId: string) => {
    const res = await api.get(`/api/policies/worker/${workerId}`);
    return res.data;
  },
  calculatePremium: async (workerId: string) => {
    const res = await api.get(`/api/policies/premium/calculate?worker_id=${workerId}`);
    return res.data;
  },
};

// Claim APIs
export const claimAPI = {
  getWorkerClaims: async (workerId: string) => {
    const res = await api.get(`/api/claims/worker/${workerId}`);
    return res.data;
  },
};

// Admin APIs
export const adminAPI = {
  getDashboard: async () => {
    const res = await api.get('/api/admin/dashboard');
    return res.data;
  },
  getPendingClaims: async () => {
    const res = await api.get('/api/admin/claims/pending');
    return res.data;
  },
  getFinancialSummary: async () => {
    const res = await api.get('/api/admin/financial-summary');
    return res.data;
  },
  getWorkers: async () => {
    const res = await api.get('/api/admin/workers');
    return res.data;
  },
  reviewClaim: async (claimId: string, approved: boolean) => {
    const res = await api.post(`/api/claims/${claimId}/review`, { approved });
    return res.data;
  },
};

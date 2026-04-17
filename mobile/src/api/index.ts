import api from './config';

// Types
export type Platform = 'ZOMATO' | 'SWIGGY' | 'BLINKIT' | 'INSTAMART';

export interface Worker {
  id: string;
  full_name: string;
  phone: string;
  upi_id: string;
  platform: Platform;
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
  ended_at?: string;
}

export interface WorkerDashboardResponse {
  worker: Worker;
  active_policy: Policy | null;
  recent_claims: Claim[];
  active_disruptions: Disruption[];
  earnings_protected: number;
}

export interface ZoneOption {
  id: string;
  name: string;
  city: string;
}

// Auth APIs
export const authAPI = {
  requestOTP: async (phone: string) => {
    const res = await api.post('/api/auth/worker/request-otp', { phone });
    return res.data;
  },
  verifyOTP: async (phone: string, otp: string) => {
    const res = await api.post('/api/auth/worker/verify-otp', { phone, otp });
    return res.data;
  },
  adminLogin: async (pin: string) => {
    const res = await api.post('/api/auth/admin/login', { pin });
    return res.data;
  },
};

// Worker APIs
export const workerAPI = {
  register: async (data: Partial<Worker>) => {
    const res = await api.post('/api/workers/register', data);
    return res.data;
  },
  getZones: async () => {
    const res = await api.get<ZoneOption[]>('/api/workers/zones');
    return res.data;
  },
  getDashboard: async (workerId: string) => {
    const res = await api.get<WorkerDashboardResponse>(`/api/workers/${workerId}/dashboard`);
    return res.data;
  },
};

// Policy APIs
export const policyAPI = {
  create: async (workerId: string, termsAccepted = false, privacyAccepted = false) => {
    const res = await api.post('/api/policies/create', {
      worker_id: workerId,
      terms_accepted: termsAccepted,
      privacy_accepted: privacyAccepted,
      terms_version: 'v1',
      privacy_version: 'v1',
      consent_text_hash: 'mobile-consent-v1',
      consent_source: 'MOBILE_APP',
    });
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
    const res = await api.post(`/api/claims/${claimId}/review`, {
      action: approved ? 'APPROVE' : 'REJECT',
    });
    return res.data;
  },
};

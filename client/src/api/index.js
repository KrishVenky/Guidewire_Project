import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Workers
export const lookupWorkerByPhone = (phone) => api.get('/workers/lookup', { params: { phone } })
export const registerWorker = (data) => api.post('/workers/register', data)
export const getWorker = (id) => api.get(`/workers/${id}`)
export const updateWorker = (id, data) => api.put(`/workers/${id}`, data)
export const getWorkerDashboard = (id) => api.get(`/workers/${id}/dashboard`)

// Policies
export const calculatePremium = (workerId) => api.get('/policies/premium/calculate', { params: { worker_id: workerId } })
export const createPolicy = (workerId) => api.post('/policies/create', { worker_id: workerId })
export const getPolicy = (id) => api.get(`/policies/${id}`)
export const getWorkerPolicies = (workerId) => api.get(`/policies/worker/${workerId}`)
export const pausePolicy = (id) => api.put(`/policies/${id}/pause`)
export const updatePolicy = (id, data) => api.put(`/policies/${id}`, data)

// Claims
export const getWorkerClaims = (workerId) => api.get(`/claims/worker/${workerId}`)
export const getClaim = (id) => api.get(`/claims/${id}`)
export const reviewClaim = (id, data) => api.post(`/claims/${id}/review`, data)
export const submitSurvey = (id, data) => api.post(`/claims/${id}/survey`, data)

// Disruptions
export const getActiveDisruptions = () => api.get('/disruptions/active')
export const getZoneDisruptions = (zoneId) => api.get(`/disruptions/zone/${zoneId}`)
export const simulateDisruption = (data) => api.post('/disruptions/simulate', data)
export const toggleBandh = (data) => api.post('/disruptions/bandh/toggle', data)

// Admin
export const getAdminDashboard = () => api.get('/admin/dashboard')
export const getPendingClaims = () => api.get('/admin/claims/pending')
export const getAllWorkers = () => api.get('/admin/workers')
export const getFinancialSummary = () => api.get('/admin/financial-summary')
export const getZoneTrustScores = () => api.get('/admin/zone-trust-scores')
export const getZones = () => api.get('/admin/zones')
export const getTriggerSources = () => api.get('/admin/trigger-sources')
export const globalReset = () => api.post('/admin/global-reset')

// LLM
export const explainClaim = (claimId) => api.post('/llm/explain-claim', { claim_id: claimId })
export const onboardingChat = (data) => api.post('/llm/onboarding-chat', data)

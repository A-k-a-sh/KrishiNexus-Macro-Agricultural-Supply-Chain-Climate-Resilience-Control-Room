import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5002';

const api = axios.create({ baseURL: BASE_URL });

// Inject token into all API requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) => 
  axios.post(`${AUTH_URL}/auth/login`, { email, password }).then(res => res.data);

export const getMe = (token) => 
  axios.get(`${AUTH_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.data);

export const refreshToken = (token) => 
  axios.post(`${AUTH_URL}/auth/refresh`, { refreshToken: token }).then(res => res.data);

// ── Districts & Upazilas ──────────────────────────────────────────────────────
export const getDistricts  = ()   => api.get('/api/districts');
export const getDistrict   = (id) => api.get(`/api/districts/${id}`);
export const getUpazilas   = (districtId) => api.get(`/api/upazilas${districtId ? `?districtId=${districtId}` : ''}`);
export const getUpazila    = (id) => api.get(`/api/upazilas/${id}`);

// ── RAG ───────────────────────────────────────────────────────────────────────
export const postRagQuery  = (body) => api.post('/api/rag/query', body);

// ── Logistics ─────────────────────────────────────────────────────────────────
export const calcLogistics      = (body) => api.post('/api/logistics/calculate', body);
export const dispatchCargo      = (body) => api.post('/api/logistics/dispatch', body);
export const getWarehouseStocks = ()     => api.get('/api/logistics/warehouse-stocks');
export const getDispatchRecords = ()     => api.get('/api/logistics/dispatch-records');

// ── Manifest ──────────────────────────────────────────────────────────────────
export const genManifest = (body) => api.post('/api/manifest', body);

// ── Market ────────────────────────────────────────────────────────────────────
export const getMarketPrices = (districtId, date, source) => {
  let query = [];
  if (date) query.push(`date=${date}`);
  if (source) query.push(`source=${source}`);
  const qString = query.length > 0 ? `?${query.join('&')}` : '';
  return api.get(`/api/market/${districtId}${qString}`);
};

export const getLatestMarketPrices = (districtId) => api.get(`/api/market/${districtId}/latest`);

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (status = 'active', filters = {}) => {
  const params = new URLSearchParams({ status, ...filters });
  return api.get(`/api/alerts?${params}`).then(res => res.data);
};

export const acknowledgeAlert = (alertId, notes = '') =>
  api.patch(`/api/alerts/${alertId}/acknowledge`, { notes }).then(res => res.data);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getRiskTrends = (days = 90) =>
  api.get(`/api/analytics/risk-trends?days=${days}`).then(res => res.data);

export const getDispatchSummary = (days = 30) =>
  api.get(`/api/analytics/dispatch-summary?days=${days}`).then(res => res.data);

export const getIngestionHealth = (limit = 20) =>
  api.get(`/api/analytics/ingestion-health?limit=${limit}`).then(res => res.data);

// ── Reports ───────────────────────────────────────────────────────────────────
export const generateReport = (reportConfig) =>
  fetch(`${BASE_URL}/api/reports/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(reportConfig)
  });
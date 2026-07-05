import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({ baseURL: BASE_URL });

// ── Districts ─────────────────────────────────────────────────────────────────
export const getDistricts  = ()   => api.get('/api/districts');
export const getDistrict   = (id) => api.get(`/api/districts/${id}`);

// ── RAG ───────────────────────────────────────────────────────────────────────
export const postRagQuery  = (body) => api.post('/api/rag/query', body);

// ── Logistics ─────────────────────────────────────────────────────────────────
export const calcLogistics      = (body) => api.post('/api/logistics/calculate', body);
export const dispatchCargo      = (body) => api.post('/api/logistics/dispatch', body);
export const getWarehouseStocks = ()     => api.get('/api/logistics/warehouse-stocks');
export const getDispatchRecords = ()     => api.get('/api/logistics/dispatch-records');

// ── Manifest ──────────────────────────────────────────────────────────────────
export const genManifest = (body) => api.post('/api/manifest', body);
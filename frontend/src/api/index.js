import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: baseUrl,
});

export const getDistricts = () => api.get('/api/districts');
export const getDistrict = (id) => api.get(`/api/districts/${id}`);
export const postRagQuery = (body) => api.post('/api/rag/query', body);
export const calcLogistics = (body) => api.post('/api/logistics/calculate', body);
export const dispatchCargo = (body) => api.post('/api/logistics/dispatch', body);
export const genManifest = (body) => api.post('/api/manifest', body);

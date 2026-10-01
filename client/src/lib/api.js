import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const isAdminRequest = /^\/(admin(?:\/|$)|quiz\/(start|end|reset)(?:\/|$)|export(?:\/|$)|leaderboard(?:\/|$))/.test(config.url || '');
  const token = isAdminRequest ? sessionStorage.getItem('adminToken') : sessionStorage.getItem('teamToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  const url = error.config?.url || '';
  if (error.response?.status === 401 && /^\/(auth\/(me|logout)|questions(?:\/|$)|progress(?:\/|$))/.test(url)) {
    sessionStorage.removeItem('teamToken');
    window.dispatchEvent(new CustomEvent('team-session-ended', { detail: error.response.data?.error }));
  }
  return Promise.reject(error);
});
export default api;

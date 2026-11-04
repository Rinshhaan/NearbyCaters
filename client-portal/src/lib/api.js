import axios from 'axios';

const RENDER_API_URL = 'https://nearbycaters.onrender.com/api/v1';

function resolveApiBaseUrl(configured = import.meta.env.VITE_API_URL) {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return RENDER_API_URL;
  try {
    const { hostname } = new URL(value);
    if (import.meta.env.PROD && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
      return RENDER_API_URL;
    }
    return value.replace(/\/$/, '');
  } catch {
    return RENDER_API_URL;
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nearme_client_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nearme_client_token');
      localStorage.removeItem('nearme_client_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

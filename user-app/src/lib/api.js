import axios from 'axios';

const RENDER_API_URL = 'https://nearbycaters.onrender.com/api/v1';
const RENDER_CLIENT_PORTAL_URL = 'https://nearbycaters-client.onrender.com';

function resolvePublicUrl(configured, fallback) {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return fallback;
  try {
    const { hostname } = new URL(value);
    if (import.meta.env.PROD && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
      return fallback;
    }
    return value.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const API_BASE_URL = resolvePublicUrl(import.meta.env.VITE_API_URL, RENDER_API_URL);
export const CLIENT_PORTAL_URL = resolvePublicUrl(
  import.meta.env.VITE_CLIENT_PORTAL_URL,
  RENDER_CLIENT_PORTAL_URL
);

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nearme_user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nearme_user_token');
      localStorage.removeItem('nearme_user_info');
    }
    return Promise.reject(error);
  }
);

export default api;

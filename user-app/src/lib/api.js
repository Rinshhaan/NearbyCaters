import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://nearbycaters.onrender.com',
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

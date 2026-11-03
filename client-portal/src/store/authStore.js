import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('nearme_client_user') || 'null'),
  token: localStorage.getItem('nearme_client_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('nearme_client_user', JSON.stringify(user));
    localStorage.setItem('nearme_client_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('nearme_client_user');
    localStorage.removeItem('nearme_client_token');
    set({ user: null, token: null });
  },
}));

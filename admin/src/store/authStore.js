import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('nearme_admin_user') || 'null'),
  token: localStorage.getItem('nearme_admin_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('nearme_admin_user', JSON.stringify(user));
    localStorage.setItem('nearme_admin_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('nearme_admin_user');
    localStorage.removeItem('nearme_admin_token');
    set({ user: null, token: null });
  },
}));

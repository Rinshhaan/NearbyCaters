import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('nearme_user_info') || 'null'),
  token: localStorage.getItem('nearme_user_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('nearme_user_info', JSON.stringify(user));
    localStorage.setItem('nearme_user_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('nearme_user_info');
    localStorage.removeItem('nearme_user_token');
    set({ user: null, token: null });
  },
}));

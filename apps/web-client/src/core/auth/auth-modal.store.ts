/**
 * Global auth modal store using Zustand.
 * Allows any component to open the login/register modal.
 */

import { create } from 'zustand';

type AuthModalMode = 'login' | 'register';

interface AuthModalState {
  isOpen: boolean;
  mode: AuthModalMode;
  openLogin: () => void;
  openRegister: () => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  mode: 'login',
  openLogin: () => set({ isOpen: true, mode: 'login' }),
  openRegister: () => set({ isOpen: true, mode: 'register' }),
  close: () => set({ isOpen: false }),
}));

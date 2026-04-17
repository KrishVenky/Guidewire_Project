import { create } from 'zustand';
import * as storage from '../lib/storage';

interface AuthState {
  isHydrated: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  workerId: string | null;
  token: string | null;
  hydrate: () => Promise<void>;
  login: (token: string, workerId: string | null, isAdmin: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  isAuthenticated: false,
  isAdmin: false,
  workerId: null,
  token: null,
  hydrate: async () => {
    try {
      const [token, workerId, role] = await Promise.all([
        storage.getItemAsync('auth_token'),
        storage.getItemAsync('worker_id'),
        storage.getItemAsync('auth_role'),
      ]);

      set({
        isHydrated: true,
        isAuthenticated: Boolean(token),
        isAdmin: role === 'admin',
        workerId,
        token,
      });
    } catch {
      set({
        isHydrated: true,
        isAuthenticated: false,
        isAdmin: false,
        workerId: null,
        token: null,
      });
    }
  },
  login: async (token: string, workerId: string | null, isAdmin: boolean) => {
    await Promise.all([
      storage.setItemAsync('auth_token', token),
      storage.setItemAsync('auth_role', isAdmin ? 'admin' : 'worker'),
      workerId
        ? storage.setItemAsync('worker_id', workerId)
        : storage.deleteItemAsync('worker_id'),
    ]);
    set({ isHydrated: true, isAuthenticated: true, isAdmin, workerId, token });
  },
  logout: async () => {
    await Promise.all([
      storage.deleteItemAsync('auth_token'),
      storage.deleteItemAsync('worker_id'),
      storage.deleteItemAsync('auth_role'),
    ]);
    set({ isHydrated: true, isAuthenticated: false, isAdmin: false, workerId: null, token: null });
  },
}));

interface AppState {
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'Home',
  setCurrentScreen: (screen: string) => set({ currentScreen: screen }),
}));

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

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
    const [token, workerId, role] = await Promise.all([
      SecureStore.getItemAsync('auth_token'),
      SecureStore.getItemAsync('worker_id'),
      SecureStore.getItemAsync('auth_role'),
    ]);

    set({
      isHydrated: true,
      isAuthenticated: Boolean(token),
      isAdmin: role === 'admin',
      workerId,
      token,
    });
  },
  login: async (token: string, workerId: string | null, isAdmin: boolean) => {
    await Promise.all([
      SecureStore.setItemAsync('auth_token', token),
      SecureStore.setItemAsync('auth_role', isAdmin ? 'admin' : 'worker'),
      workerId
        ? SecureStore.setItemAsync('worker_id', workerId)
        : SecureStore.deleteItemAsync('worker_id'),
    ]);
    set({ isHydrated: true, isAuthenticated: true, isAdmin, workerId, token });
  },
  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('auth_token'),
      SecureStore.deleteItemAsync('worker_id'),
      SecureStore.deleteItemAsync('auth_role'),
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

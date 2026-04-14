import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  workerId: string | null;
  token: string | null;
  login: (token: string, workerId: string | null, isAdmin: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isAdmin: false,
  workerId: null,
  token: null,
  login: async (token: string, workerId: string | null, isAdmin: boolean) => {
    await SecureStore.setItemAsync('auth_token', token);
    set({ isAuthenticated: true, isAdmin, workerId, token });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ isAuthenticated: false, isAdmin: false, workerId: null, token: null });
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

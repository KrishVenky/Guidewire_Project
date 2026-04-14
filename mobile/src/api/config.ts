import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const fallbackBaseUrl =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8000'
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://127.0.0.1:8000';

// Set EXPO_PUBLIC_API_BASE_URL for physical devices or deployed backends.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// TODO: Update this URL after deploying your backend
// For local testing: use your computer's IP (not localhost)
// Example: http://192.168.1.100:8000
const API_BASE_URL = 'http://192.168.1.100:8000';

// For deployed backend (update after deployment):
// const API_BASE_URL = 'https://your-app.railway.app';

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

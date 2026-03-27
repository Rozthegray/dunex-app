import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  // 1. ALWAYS prefer the .env variable if it exists (Best Practice)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Local Development Fallback (Only runs if .env is missing and you are coding)
  if (__DEV__) {
    // Android Emulator routes to host machine
    if (Platform.OS === 'android') return 'https://dunex-backend.onrender.com/api/v1';
    
    // Explicitly use 'localhost' instead of '127.0.0.1' for Web and iOS
    return 'https://dunex-backend.onrender.com/api/v1'; 
  }
  
  // 3. Official Production Engine (Runs when compiled into an .apk)
return 'https://dunex-backend.onrender.com/api/v1';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',

    timeout: 60000,
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    // 1. Attach the Auth Token
    const token = await AsyncStorage.getItem('user_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 2. Automatically generate and attach the Idempotency-Key for POST/PUT requests
    if (config.method === 'post' || config.method === 'put' || config.method === 'patch') {
      // Creates a unique random string (e.g., 'k3f8j9x2-16a8b9c0d')
      const uniqueKey = Math.random().toString(36).substring(2) + '-' + Date.now().toString(36);
      config.headers['Idempotency-Key'] = uniqueKey;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);
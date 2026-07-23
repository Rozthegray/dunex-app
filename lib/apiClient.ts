import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 🚨 CRITICAL: Enter your computer's actual Wi-Fi IPv4 address here.
// Run 'ipconfig' in your Windows command prompt to find it.
const MY_COMPUTER_IP = '192.168.1.15'; 

const getBaseUrl = () => {
  // 🚨 FORCED PRODUCTION TEST: 
  // Bypassing the local network and pointing straight to the live cloud engine.
  return 'https://dunex-backend.onrender.com/api/v1';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, 
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('user_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (config.method === 'post' || config.method === 'put' || config.method === 'patch') {
      const uniqueKey = Math.random().toString(36).substring(2) + '-' + Date.now().toString(36);
      config.headers['Idempotency-Key'] = uniqueKey;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.request.use(
  async (config) => {
    // 1. Attach the Auth Token
    const token = await AsyncStorage.getItem('user_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 2. Automatically generate and attach the Idempotency-Key for POST/PUT requests
    if (config.method === 'post' || config.method === 'put' || config.method === 'patch') {
      const uniqueKey = Math.random().toString(36).substring(2) + '-' + Date.now().toString(36);
      config.headers['Idempotency-Key'] = uniqueKey;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);
// dunex-mobile/lib/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

interface AuthState {
  token: string | null;
  user: any | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true, 

  login: async (email, password) => {
    try {
      set({ isLoading: true });
      
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await apiClient.post('auth/login', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      const token = response.data.access_token;
      await AsyncStorage.setItem('user_token', token);
      
      const userRes = await apiClient.get('auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("[AuthStore] Login Successful. User Data:", userRes.data);
      set({ token, user: userRes.data, isLoading: false });
    } catch (error) {
      console.error("[AuthStore] Login Failed:", error);
      set({ isLoading: false });
      throw error; 
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('user_token');
    set({ token: null, user: null, isLoading: false });
  },

  setUser: (user) => set({ user }),

  checkSession: async () => {
    try {
      let token = await AsyncStorage.getItem('user_token');

      // 🚨 CRITICAL FIX: Intercept impersonation token directly in the store!
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const impersonateToken = urlParams.get('impersonate_token');
        
        if (impersonateToken) {
          console.log("[AuthStore] Impersonation Token Intercepted!");
          token = impersonateToken;
          
          // Use AsyncStorage to properly set the "user_token" key
          await AsyncStorage.setItem('user_token', token);
          
          // Clean the URL so it looks completely normal
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      if (token) {
        console.log("[AuthStore] Token found, verifying session...");
        const userRes = await apiClient.get('auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("[AuthStore] Session Restored:", userRes.data);
        set({ token, user: userRes.data, isLoading: false });
      } else {
        console.log("[AuthStore] No token found in storage.");
        set({ isLoading: false });
      }
    } catch (error) {
      console.log("[AuthStore] Session expired or invalid.");
      await AsyncStorage.removeItem('user_token');
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
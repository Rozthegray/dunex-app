import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuthStore } from './authStore';

const getWsUrl = (userId: string) => {
  // 1. Local Development Routing
  if (__DEV__) {
    // Android Emulator uses a special IP alias to reach localhost
    if (Platform.OS === 'android') {
      return `ws://10.0.2.2:8000/api/v1/ws/notifications/${userId}`;
    }
    // Web Browser and iOS Simulator use standard localhost/127.0.0.1
    // Notice we use 'ws://' instead of 'wss://' for local testing!
    return `ws://127.0.0.1:8000/api/v1/ws/notifications/${userId}`;
  }
  
  // 2. Official Production WebSockets Engine
  // Notice we use 'wss://' for secure WebSockets on Render
  return `wss://dunex-backend.onrender.com/api/v1/ws/notifications/${userId}`;
};

export const useNotifications = () => {
  const { user } = useAuthStore();
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Connect to the Python WebSocket
    ws.current = new WebSocket(getWsUrl(user.id));

    ws.current.onopen = () => {
      console.log('✅ Connected to Dunex Real-Time Server');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 1. Handle Global Admin Broadcasts
        if (data.type === 'system_alert') {
          Alert.alert(`📣 ${data.title}`, data.body);
        } 
        // 2. Handle Settings Updates
        else if (data.type === 'settings_update') {
          console.log("Admin updated system settings:", data.data);
          // You could trigger a state refresh here
        }
        // 3. Handle Direct Messages (like Deposit Approvals)
        else if (data.type === 'direct_message') {
          Alert.alert('Wallet Update 💰', data.message);
          // If you have a global function to fetch the wallet balance, call it here!
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    };

    ws.current.onclose = () => {
      console.log('❌ Disconnected from Real-Time Server');
    };

    return () => {
      ws.current?.close();
    };
  }, [user?.id]);
};
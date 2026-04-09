import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/authStore';

export default function RootLayout() {
  // 🚨 1. Pull the 'user' object from the store so we can read their status
  const { token, user, isLoading, checkSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Check device storage for a session when the app boots
  useEffect(() => {
    checkSession();
  }, []);

  // Route protection logic
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      // Not logged in? Kick them to the login screen
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      
      // 🚨 2. THE KYC BOUNCER
      // If they have a token but no KYC, route them to the KYC screen!
      if (user && (!user.kyc_status || user.kyc_status === 'unverified')) {
        router.replace('/(app)/kyc');
      } else {
        // Otherwise, they are good to go to the dashboard
        router.replace('/(app)'); 
      }
      
    }
  }, [token, user, isLoading, segments]);

  if (isLoading) {
    // (I updated your loading colors to match your dark/gold Dunex branding!)
    return (
      <View style={{ flex: 1, backgroundColor: '#05050A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  // <Slot /> renders whatever the current route is (Login, Register, or the Main App)
  return <Slot />;
}
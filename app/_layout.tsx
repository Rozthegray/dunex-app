import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/authStore';

export default function RootLayout() {
  const { token, isLoading, checkSession } = useAuthStore();
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
      // Already logged in? Push them to the root dashboard
     router.replace('/(app)'); 
    }
  }, [token, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // <Slot /> renders whatever the current route is (Login, Register, or the Main App)
  return <Slot />;
}
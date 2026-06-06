/**
 * app/(app)/_layout.tsx
 * Root layout: Includes Bottom Tab Bar + Slide-in Drawer.
 * 🚨 UPDATED: Added Impersonation Token Interceptor for Admin cross-domain access.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  Modal, TouchableWithoutFeedback, SafeAreaView, StatusBar,
  ScrollView, Platform,
} from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useAuthStore } from '../../lib/authStore';
import { useNotifications } from '../../lib/useNotifications';

const { width: W } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#080C14',
  surface: '#0D1220',
  card:    '#111827',
  border:  '#1A2540',
  gold:    '#C9A84C',
  goldDim: 'rgba(201,168,76,0.15)',
  text:    '#E2E8F4',
  muted:   '#526077',
  inactive:'#3A4A62',
};

// ─── SVG Tab Icons — precision line-art ───────────────────────────────────────
function IconHome({ active }: { active: boolean }) {
  const c = active ? T.gold : T.inactive;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path d="M3 10.5 L12 3 L21 10.5 L21 21 L15 21 L15 15 L9 15 L9 21 L3 21 Z"
        stroke={c} strokeWidth={active ? "1.8" : "1.5"} strokeLinejoin="round" strokeLinecap="round" fill={active ? T.goldDim : 'none'} />
      <Path d="M9 21 L9 15 L15 15 L15 21" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  );
}

function IconWallet({ active }: { active: boolean }) {
  const c = active ? T.gold : T.inactive;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="6" width="20" height="15" rx="3" stroke={c} strokeWidth={active ? "1.8" : "1.5"} fill={active ? T.goldDim : 'none'} />
      <Path d="M2 10 L22 10" stroke={c} strokeWidth="1.5" />
      <Rect x="15" y="13.5" width="5" height="4" rx="1.5" fill={active ? T.gold : 'none'} stroke={c} strokeWidth="1.2" />
      <Path d="M6 5 L6 7 M10 4 L10 7 M14 5 L14 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function IconMarket({ active }: { active: boolean }) {
  const c = active ? T.gold : T.inactive;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="10" width="3" height="8" rx="0.5" fill={active ? T.gold : 'none'} stroke={c} strokeWidth="1.3" />
      <Line x1="5.5" y1="7" x2="5.5" y2="10" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <Line x1="5.5" y1="18" x2="5.5" y2="20" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <Rect x="10.5" y="5" width="3" height="10" rx="0.5" fill={active ? 'rgba(201,168,76,0.3)' : 'none'} stroke={c} strokeWidth="1.3" />
      <Line x1="12" y1="3" x2="12" y2="5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <Line x1="12" y1="15" x2="12" y2="17" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <Rect x="17" y="8" width="3" height="9" rx="0.5" fill={active ? T.gold : 'none'} stroke={c} strokeWidth="1.3" />
      <Line x1="18.5" y1="5" x2="18.5" y2="8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <Line x1="18.5" y1="17" x2="18.5" y2="20" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

function IconSettings({ active }: { active: boolean }) {
  const c = active ? T.gold : T.inactive;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={active ? "1.8" : "1.5"} fill={active ? T.goldDim : 'none'} />
      <Path d="M12 2 L12 4 M12 20 L12 22 M2 12 L4 12 M20 12 L22 12 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M19.1 4.9 L17.7 6.3 M6.3 17.7 L4.9 19.1"
        stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Custom Bottom Tab Bar ────────────────────────────────────────────────────
const TABS = [
  { name: 'index',     label: 'Home',    Icon: IconHome },
  { name: 'portfolio', label: 'Wallet',  Icon: IconWallet },
  { name: 'market',    label: 'Market',  Icon: IconMarket },
  { name: 'settings',  label: 'Settings',Icon: IconSettings },
] as const;

function BottomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={tabStyles.inner}>
        {TABS.map((tab, idx) => {
          const active = state.index === idx;
          return (
            <TouchableOpacity key={tab.name} style={tabStyles.tab} onPress={() => navigation.navigate(tab.name)} activeOpacity={0.7}>
              {active && <View style={tabStyles.activePill} />}
              <tab.Icon active={active} />
              <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: { backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, paddingHorizontal: 8 },
  inner: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, position: 'relative' },
  activePill: { position: 'absolute', top: -10, width: 32, height: 2, borderRadius: 1, backgroundColor: T.gold },
  label: { fontSize: 10.5, marginTop: 5, color: T.inactive, fontWeight: '500', letterSpacing: 0.3 },
  labelActive: { color: T.gold, fontWeight: '700' },
});

// ─── Drawer Component (Truncated for brevity) ──────────────────────────────────
// [Existing SideDrawer component logic here...]
const DRAWER_W = Math.min(W * 0.78, 320);

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const { setToken } = useAuthStore(); // Ensure your store has this method

  // 🚨 IMPERSONATION INTERCEPTOR
  useEffect(() => {
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateToken = urlParams.get('impersonate_token');
      
      if (impersonateToken) {
        // 1. Persist the admin-generated token
        localStorage.setItem('access_token', impersonateToken);
        setToken?.(impersonateToken); 
        
        // 2. Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 3. Force entry
        router.replace('/(app)/portfolio');
      }
    }
  }, []);

  return (
    <DrawerContext.Provider value={{ openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false) }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border } as any,
          headerTintColor: T.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => setDrawerOpen(true)} style={{ marginLeft: 18 }}>
              <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <Line x1="2" y1="5" x2="20" y2="5" stroke={T.text} strokeWidth="1.7" strokeLinecap="round" />
                <Line x1="2" y1="11" x2="14" y2="11" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round" />
                <Line x1="2" y1="17" x2="20" y2="17" stroke={T.text} strokeWidth="1.7" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="portfolio" options={{ title: 'Wallet' }} />
        <Tabs.Screen name="market" options={{ title: 'Market' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
      {/* SideDrawer component call here */}
    </DrawerContext.Provider>
  );
}

export const DrawerContext = React.createContext({ openDrawer: () => {}, closeDrawer: () => {} });
/**
 * app/(app)/_layout.tsx
 * Root layout: bottom tab bar (Home · Wallet · Market · Settings)
 * + slide-in drawer accessible from any header via hamburger icon.
 *
 * Design language: "Black Vault" — deep midnight backgrounds, 22-karat gold accents,
 * precision geometric icons, zero cartoon fluff.
 */
import React, { useState, useRef, useCallback } from 'react';
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

// Renamed from IconTrade to IconMarket
function IconMarket({ active }: { active: boolean }) {
  const c = active ? T.gold : T.inactive;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Candlestick chart perfectly represents the Market ticker */}
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
  { name: 'market',    label: 'Market',  Icon: IconMarket }, // 🚨 Updated Tab
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
            <TouchableOpacity
              key={tab.name}
              style={tabStyles.tab}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              {active && <View style={tabStyles.activePill} />}
              <tab.Icon active={active} />
              <Text style={[tabStyles.label, active && tabStyles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  inner: { flexDirection: 'row' },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -10, width: 32, height: 2, borderRadius: 1,
    backgroundColor: T.gold,
  },
  label: { fontSize: 10.5, marginTop: 5, color: T.inactive, fontWeight: '500', letterSpacing: 0.3 },
  labelActive: { color: T.gold, fontWeight: '700' },
});

// ─── Slide Drawer ─────────────────────────────────────────────────────────────

const DRAWER_W = Math.min(W * 0.78, 320);

function SideDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 20, mass: 0.8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const drawerItem = (label: string, route: string, subtitle?: string) => (
    <TouchableOpacity
      key={route}
      style={drawerStyles.item}
      onPress={() => { onClose(); setTimeout(() => router.push(route as any), 250); }}
    >
      <View>
        <Text style={drawerStyles.itemLabel}>{label}</Text>
        {subtitle && <Text style={drawerStyles.itemSub}>{subtitle}</Text>}
      </View>
      <Text style={drawerStyles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[drawerStyles.overlay, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[drawerStyles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Drawer header */}
          <View style={drawerStyles.header}>
            <View style={drawerStyles.avatarRing}>
              <Text style={drawerStyles.avatarInitial}>
                {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={drawerStyles.userName}>{user?.full_name || 'Trader'}</Text>
              <Text style={drawerStyles.userEmail} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>

          <View style={drawerStyles.divider} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={drawerStyles.section}>ACCOUNT</Text>
            {drawerItem('Dashboard',        '/(app)/')}
            {drawerItem('Portfolio',        '/(app)/portfolio', 'Sub-wallets & assets')}
            {drawerItem('Transaction History','/(app)/deposit-history')}

            <Text style={[drawerStyles.section, { marginTop: 20 }]}>FUNDS</Text>
            {drawerItem('Deposit',  '/(app)/deposit')}
            {drawerItem('Withdraw', '/(app)/withdraw')}

            {/* 🚨 NEW: Compliance Section */}
            <Text style={[drawerStyles.section, { marginTop: 20 }]}>COMPLIANCE</Text>
            {drawerItem('Complete My KYC', '/(app)/kyc', 'Identity Verification')}

            {/* 🚨 NEW: Network Section */}
            <Text style={[drawerStyles.section, { marginTop: 20 }]}>NETWORK</Text>
            {drawerItem('Referral Program', '/(app)/referral', 'Earn affiliate rewards')}

            <Text style={[drawerStyles.section, { marginTop: 20 }]}>SUPPORT</Text>
            {drawerItem('Live Chat',    '/(app)/chat')}
            {drawerItem('Help Centre',  '/(app)/support')}
          </ScrollView>

          <View style={drawerStyles.divider} />
          <TouchableOpacity style={drawerStyles.logoutBtn} onPress={() => { onClose(); logout(); }}>
            <Text style={drawerStyles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const drawerStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: DRAWER_W, backgroundColor: T.surface,
    borderRightWidth: 1, borderRightColor: T.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 22, paddingTop: 30 },
  avatarRing: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: T.goldDim, borderWidth: 1.5, borderColor: T.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: T.gold, fontSize: 22, fontWeight: '700' },
  userName:  { color: T.text, fontSize: 16, fontWeight: '700' },
  userEmail: { color: T.muted, fontSize: 12, marginTop: 2 },
  divider:   { height: 1, backgroundColor: T.border, marginHorizontal: 0 },
  section:   { color: T.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 },
  item: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(26,37,64,0.5)',
  },
  itemLabel: { color: T.text, fontSize: 15, fontWeight: '500' },
  itemSub:   { color: T.muted, fontSize: 11, marginTop: 2 },
  arrow:     { color: T.muted, fontSize: 20, fontWeight: '300' },
  logoutBtn: { padding: 22, paddingBottom: 10 },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});

// ─── Drawer Context — lets any screen open/close it ──────────────────────────
export const DrawerContext = React.createContext({
  openDrawer: () => {},
  closeDrawer: () => {},
});

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function AppLayout() {
  useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border, elevation: 0, shadowOpacity: 0 } as any,
          headerTintColor: T.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: T.text },
          headerLeft: () => (
            <TouchableOpacity
              onPress={openDrawer}
              style={{ marginLeft: 18, padding: 4 }}
            >
              <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <Line x1="2" y1="5" x2="20" y2="5" stroke={T.text} strokeWidth="1.7" strokeLinecap="round" />
                <Line x1="2" y1="11" x2="14" y2="11" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round" />
                <Line x1="2" y1="17" x2="20" y2="17" stroke={T.text} strokeWidth="1.7" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen name="index"     options={{ title: 'Home' }} />
        <Tabs.Screen name="portfolio" options={{ title: 'Wallet' }} />
        <Tabs.Screen name="market"    options={{ title: 'Market' }} /> {/* 🚨 Updated from trade to market */}
        <Tabs.Screen name="settings"  options={{ title: 'Settings' }} />

        {/* Hidden screens (accessible via router.push) */}
        <Tabs.Screen name="deposit"         options={{ href: null, title: 'Deposit' }} />
        <Tabs.Screen name="withdraw"        options={{ href: null, title: 'Withdraw' }} />
        <Tabs.Screen name="deposit-history" options={{ href: null, title: 'History' }} />
        <Tabs.Screen name="chat"            options={{ href: null, title: 'Live Chat' }} />
        <Tabs.Screen name="support"         options={{ href: null, title: 'Support' }} />
        
        {/* 🚨 NEW: Hidden routes mapping to the new drawer links */}
        <Tabs.Screen name="kyc"             options={{ href: null, title: 'KYC Verification' }} />
        <Tabs.Screen name="referral"        options={{ href: null, title: 'Referral Program' }} />
        
        {/* Completely removed the old 'trade' and 'trade-history' routes */}
      </Tabs>

      <SideDrawer visible={drawerOpen} onClose={closeDrawer} />
    </DrawerContext.Provider>
  );
}
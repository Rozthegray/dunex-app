/**
 * app/(app)/index.tsx  — Home Screen
 *
 * Layout (top → bottom):
 * 1. Header        greeting + notifications + avatar
 * 2. Wallet card   balance · show/hide · Deposit · Withdraw
 * 3. Owned Assets  horizontal scroll of sub-wallets
 * 4. Market        live prices top 6
 * 5. News          auto-scrolling headline cards
 * 6. Activity      recent transactions ledger
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, DeviceEventEmitter, Animated,
  Dimensions, FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';
import { useAuthStore } from '../../lib/authStore';
import { apiClient } from '../../lib/apiClient';
import { CoinIcon, coinColor } from '../../components/CoinIcon';

const { width: W } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        '#080C14',
  surface:   '#0D1220',
  card:      '#111827',
  cardHigh:  '#141E30',
  border:    '#1A2540',
  borderSub: '#0F1929',
  gold:      '#C9A84C',
  goldBright:'#E2C878',
  goldDim:   'rgba(201,168,76,0.12)',
  goldGlow:  'rgba(201,168,76,0.06)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.12)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.12)',
  text:      '#E2E8F4',
  sub:       '#94A3B8',
  muted:     '#526077',
  dim:       '#2A3A54',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Transaction  { id: string; amount: number; transaction_type: string; status: string; created_at: string; }
interface MarketAsset  { symbol: string; name: string; current_price: number; price_change_percent: number; }
interface SubWallet    { symbol: string; balance: number; current_price: number; value_usd: number; }

// Placeholder news — replace with real feed later
const CRYPTO_NEWS = [
  { id: '1', headline: 'Bitcoin eyes $75K resistance as spot ETF inflows hit new monthly record', source: 'CoinDesk', tag: 'BTC' },
  { id: '2', headline: 'Ethereum gas fees drop to 2021 lows after Dencun upgrade fully propagates', source: 'The Block', tag: 'ETH' },
  { id: '3', headline: 'Solana DEX volume surpasses Ethereum mainnet for third straight week', source: 'Blockworks', tag: 'SOL' },
  { id: '4', headline: 'SEC reviewing 12 spot Ether ETF applications simultaneously', source: 'Reuters', tag: 'ETH' },
  { id: '5', headline: 'BlackRock IBIT registers $400M single-day inflow, breaking own record', source: 'Bloomberg', tag: 'BTC' },
];

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Sparkline({ positive, width = 64, height = 28 }: { positive: boolean; width?: number; height?: number }) {
  const points = positive
    ? [0, 18, 14, 12, 22, 8, 28, 10, 40, 4, 52, 6, 64, 2]
    : [0, 4, 12, 8, 24, 12, 32, 18, 44, 14, 56, 20, 64, 24];
  const pStr = points.reduce((s, v, i) => i % 2 === 0 ? s + `${v},` : s + `${v} `, '').trim();
  const c = positive ? T.green : T.red;
  return (
    <Svg width={width} height={height} viewBox={`0 0 64 28`}>
      <Polyline points={pStr} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Balance visibility toggle ────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      {open ? (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" />
          <Circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8" />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
          <Line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionRow({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionLeft}>
        <View style={s.sectionDash} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={s.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [balance,    setBalance]    = useState(0);
  const [hidden,     setHidden]     = useState(false);
  const [assets,     setAssets]     = useState<SubWallet[]>([]);
  const [market,     setMarket]     = useState<MarketAsset[]>([]);
  const [recentTx,   setRecentTx]   = useState<Transaction[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // News auto-scroll
  const newsScroll   = useRef<ScrollView>(null);
  const newsIndexRef = useRef(0);
  const newsAnim     = useRef(new Animated.Value(0)).current;

  const fetchAll = async () => {
    const [wallet, history, me, portfolio, mkt] = await Promise.allSettled([
      apiClient.get('/wallet/my-wallet'),
      apiClient.get('/wallet/history'),
      apiClient.get('/auth/me'),
      apiClient.get('/trade/portfolio'),
      apiClient.get('/trade/market'),
    ]);

    if (wallet.status === 'fulfilled' && wallet.value?.data)
      setBalance(wallet.value.data.cached_balance ?? 0);
    if (history.status === 'fulfilled' && history.value?.data)
      setRecentTx(history.value.data.slice(0, 5));
    if (me.status === 'fulfilled' && me.value?.data)
      setUser(me.value.data);
    if (portfolio.status === 'fulfilled' && portfolio.value?.data?.assets)
      setAssets(portfolio.value.data.assets.slice(0, 6));
    if (mkt.status === 'fulfilled' && mkt.value?.data)
      setMarket(mkt.value.data.slice(0, 6));

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('refresh_dashboard', fetchAll);
    return () => sub.remove();
  }, []);

  // News auto-scroll every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      newsIndexRef.current = (newsIndexRef.current + 1) % CRYPTO_NEWS.length;
      newsScroll.current?.scrollTo({ x: newsIndexRef.current * (W - 48), animated: true });
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={T.gold} />
      </View>
    );
  }

  const fmt = (n: number) => hidden ? '••••••' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
    >

      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good day,</Text>
          <Text style={s.name}>{user?.full_name?.split(' ')[0] || 'Trader'}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/(app)/chat' as any)}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={T.sub} strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={T.sub} strokeWidth="1.8" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/(app)/settings' as any)}>
            <Text style={s.avatarText}>
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. Wallet Card ─────────────────────────────────────────────────── */}
      <View style={s.walletCard}>
        {/* Gold top bar */}
        <View style={s.walletGoldBar} />

        <View style={s.walletCardInner}>
          <View style={s.walletTopRow}>
            <Text style={s.walletLabel}>TOTAL BALANCE</Text>
            <TouchableOpacity onPress={() => setHidden(h => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <EyeIcon open={!hidden} />
            </TouchableOpacity>
          </View>

          <View style={s.balanceRow}>
            <Text style={s.balanceCurr}>$</Text>
            <Text style={s.balanceNum}>
              {hidden ? '••••••' : balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <View style={s.currBadge}><Text style={s.currBadgeText}>USD</Text></View>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statBlock}>
              <View style={[s.statDot, { backgroundColor: T.greenDim }]}>
                <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <Path d="M2 8L6 4L10 8" stroke={T.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View>
                <Text style={s.statLabel}>Total Profit</Text>
                <Text style={[s.statVal, { color: T.green }]}>$0.00</Text>
              </View>
            </View>
            <View style={s.statBlock}>
              <View style={[s.statDot, { backgroundColor: T.goldDim }]}>
                <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <Path d="M6 1.5L7.8 4.9L11.5 5.4L9 7.8L9.6 11.5L6 9.6L2.4 11.5L3 7.8L0.5 5.4L4.2 4.9L6 1.5Z" stroke={T.gold} strokeWidth="1.2" strokeLinejoin="round" />
                </Svg>
              </View>
              <View>
                <Text style={s.statLabel}>Bonus</Text>
                <Text style={[s.statVal, { color: T.gold }]}>$0.00</Text>
              </View>
            </View>
          </View>

          {/* Deposit / Withdraw */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.depositBtn} onPress={() => router.push('/(app)/deposit' as any)}>
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path d="M12 3v14M5 14l7 7 7-7" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={s.depositText}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.withdrawBtn} onPress={() => router.push('/(app)/withdraw' as any)}>
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path d="M12 21V7M5 10l7-7 7 7" stroke={T.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={s.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── 3. Owned Assets ────────────────────────────────────────────────── */}
      {assets.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <SectionRow
            title="Your Assets"
            onSeeAll={() => router.push('/(app)/portfolio' as any)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.assetListContent}
          >
            {assets.map(a => {
              const positive = true; // you'd derive from price history
              return (
                <TouchableOpacity key={a.symbol} style={s.assetChip} activeOpacity={0.8}>
                  <CoinIcon symbol={a.symbol} size={36} />
                  <Text style={s.assetSym}>{a.symbol}</Text>
                  <Text style={s.assetBal}>{a.balance.toFixed(4)}</Text>
                  <Text style={[s.assetUsd, { color: T.gold }]}>
                    ${a.value_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── 4. Market List ─────────────────────────────────────────────────── */}
      <View style={{ marginTop: 28 }}>
        <SectionRow title="Market" onSeeAll={() => router.push('/(app)/market' as any)} />
        <View style={s.marketList}>
          {market.map((coin, idx) => {
            const up  = coin.price_change_percent >= 0;
            const pct = `${up ? '+' : ''}${coin.price_change_percent.toFixed(2)}%`;
            return (
              <TouchableOpacity
                key={coin.symbol}
                style={[s.marketRow, idx === market.length - 1 && { borderBottomWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => router.push('/(app)/trade' as any)}
              >
                <CoinIcon symbol={coin.symbol} size={38} />
                <View style={s.marketMid}>
                  <Text style={s.marketSym}>{coin.symbol}</Text>
                  <Text style={s.marketName}>{coin.name}</Text>
                </View>
                <Sparkline positive={up} />
                <View style={s.marketRight}>
                  <Text style={s.marketPrice}>
                    ${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: coin.current_price > 100 ? 2 : 4 })}
                  </Text>
                  <View style={[s.pctBadge, { backgroundColor: up ? T.greenDim : T.redDim }]}>
                    <Text style={[s.pctText, { color: up ? T.green : T.red }]}>{pct}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 5. News Ticker ─────────────────────────────────────────────────── */}
      <View style={{ marginTop: 28 }}>
        <SectionRow title="Crypto Pulse" />
        <ScrollView
          ref={newsScroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          scrollEnabled={false}
        >
          {CRYPTO_NEWS.map(item => (
            <View key={item.id} style={[s.newsCard, { width: W - 48 }]}>
              <View style={s.newsTagRow}>
                <CoinIcon symbol={item.tag} size={20} />
                <Text style={s.newsTag}>{item.tag}</Text>
                <View style={s.newsDot} />
                <Text style={s.newsSource}>{item.source}</Text>
              </View>
              <Text style={s.newsHeadline} numberOfLines={2}>{item.headline}</Text>
            </View>
          ))}
        </ScrollView>
        {/* Dot indicators */}
        <View style={s.newsDots}>
          {CRYPTO_NEWS.map((_, i) => (
            <View key={i} style={[s.dotIndicator, i === 0 && s.dotActive]} />
          ))}
        </View>
      </View>

      {/* ── 6. User Activity ───────────────────────────────────────────────── */}
      <View style={{ marginTop: 28, marginBottom: 36 }}>
        <SectionRow
          title="Activity"
          onSeeAll={() => router.push('/(app)/deposit-history' as any)}
        />
        <View style={s.activityList}>
          {recentTx.length === 0 ? (
            <View style={s.emptyActivity}>
              <Svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <Circle cx="16" cy="16" r="14" stroke={T.dim} strokeWidth="1.5" />
                <Path d="M16 10v6M16 20v2" stroke={T.dim} strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={s.emptyText}>No recent activity</Text>
            </View>
          ) : (
            recentTx.map((tx, idx) => {
              const d      = new Date(tx.created_at);
              const isDepo = tx.transaction_type === 'deposit';
              const done   = tx.status === 'completed';
              return (
                <View key={tx.id} style={[s.txRow, idx === recentTx.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.txIcon, { backgroundColor: isDepo ? T.greenDim : T.goldDim }]}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      {isDepo
                        ? <Path d="M12 3v14M5 14l7 7 7-7" stroke={T.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        : <Path d="M12 21V7M5 10l7-7 7 7" stroke={T.gold}  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      }
                    </Svg>
                  </View>
                  <View style={s.txMid}>
                    <Text style={s.txType}>{isDepo ? 'Deposit' : 'Withdrawal'}</Text>
                    <Text style={s.txDate}>
                      {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {/* 🚨 FIX: Wrap tx.amount in Math.abs() to strip the backend's negative sign 🚨 */}
                    <Text style={[s.txAmt, { color: isDepo ? T.green : T.text }]}>
                      {isDepo ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <View style={[s.statusPill, { backgroundColor: done ? T.greenDim : 'rgba(234,179,8,0.12)' }]}>
                      <Text style={[s.statusText, { color: done ? T.green : '#EAB308' }]}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },
  root:   { flex: 1, backgroundColor: T.bg },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 },
  greeting:    { color: T.muted, fontSize: 13, letterSpacing: 0.3 },
  name:        { color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldDim, borderWidth: 1.5, borderColor: T.gold, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: T.gold, fontSize: 16, fontWeight: '700' },

  // Wallet Card
  walletCard:      { marginHorizontal: 20, marginTop: 18, backgroundColor: T.card, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  walletGoldBar:   { height: 2.5, backgroundColor: T.gold, marginHorizontal: 0 },
  walletCardInner: { padding: 22 },
  walletTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  walletLabel:     { color: T.muted, fontSize: 10.5, letterSpacing: 2, fontWeight: '700' },
  balanceRow:      { flexDirection: 'row', alignItems: 'baseline', marginBottom: 22 },
  balanceCurr:     { color: T.gold, fontSize: 26, fontWeight: '700', marginRight: 3, marginBottom: 4 },
  balanceNum:      { color: T.text, fontSize: 44, fontWeight: '900', letterSpacing: -2 },
  currBadge:       { marginLeft: 10, backgroundColor: T.goldDim, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-end', marginBottom: 6 },
  currBadgeText:   { color: T.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statsRow:        { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 18, marginBottom: 20 },
  statBlock:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot:         { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  statLabel:       { color: T.muted, fontSize: 11, letterSpacing: 0.3 },
  statVal:         { color: T.text, fontSize: 15, fontWeight: '700', marginTop: 1 },
  actionRow:       { flexDirection: 'row', gap: 10 },
  depositBtn:      { flex: 1, backgroundColor: T.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 7 },
  depositText:     { color: '#080C14', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  withdrawBtn:     { flex: 1, backgroundColor: T.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 7, borderWidth: 1, borderColor: T.border },
  withdrawText:    { color: T.text, fontWeight: '700', fontSize: 15 },

  // Section header
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 14 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDash: { width: 3, height: 16, borderRadius: 2, backgroundColor: T.gold },
  sectionTitle:{ color: T.text, fontSize: 16, fontWeight: '700' },
  seeAll:      { color: T.gold, fontSize: 13, fontWeight: '600' },

  // Owned Assets
  assetListContent: { paddingHorizontal: 20, gap: 10 },
  assetChip: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 14, alignItems: 'center', minWidth: 100, gap: 6,
  },
  assetSym:  { color: T.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  assetBal:  { color: T.muted, fontSize: 10.5 },
  assetUsd:  { fontSize: 12, fontWeight: '700' },

  // Market
  marketList: { marginHorizontal: 20, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  marketRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSub, gap: 12 },
  marketMid:  { flex: 1 },
  marketSym:  { color: T.text, fontSize: 14, fontWeight: '700' },
  marketName: { color: T.muted, fontSize: 11, marginTop: 2 },
  marketRight:{ alignItems: 'flex-end', gap: 5 },
  marketPrice:{ color: T.text, fontSize: 14, fontWeight: '700' },
  pctBadge:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pctText:    { fontSize: 11, fontWeight: '700' },

  // News
  newsCard:    { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 18, marginRight: 8 },
  newsTagRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  newsTag:     { color: T.gold, fontSize: 12, fontWeight: '700' },
  newsDot:     { width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.dim },
  newsSource:  { color: T.muted, fontSize: 11 },
  newsHeadline:{ color: T.text, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  newsDots:    { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  dotIndicator:{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.dim },
  dotActive:   { backgroundColor: T.gold, width: 16 },

  // Activity
  activityList:   { marginHorizontal: 20, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  emptyActivity:  { padding: 32, alignItems: 'center', gap: 10 },
  emptyText:      { color: T.muted, fontSize: 14 },
  txRow:          { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.borderSub, gap: 12 },
  txIcon:         { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txMid:          { flex: 1 },
  txType:         { color: T.text, fontSize: 14, fontWeight: '600' },
  txDate:         { color: T.muted, fontSize: 11, marginTop: 2 },
  txAmt:          { fontSize: 15, fontWeight: '700' },
  statusPill:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText:     { fontSize: 10.5, fontWeight: '700' },
});
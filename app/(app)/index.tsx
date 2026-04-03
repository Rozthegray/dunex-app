import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, DeviceEventEmitter, Dimensions, Image, FlatList
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/authStore';
import { apiClient } from '../../lib/apiClient';
import { usePortfolio } from '../../hooks/usePortfolio';

const { width: W } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        '#080C14',
  surface:   '#0D1220',
  card:      '#111827',
  border:    '#1A2540',
  borderSub: '#0F1929',
  gold:      '#C9A84C',
  goldDim:   'rgba(201,168,76,0.12)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.12)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.12)',
  blue:      '#3B82F6',
  blueDim:   'rgba(59,130,246,0.12)',
  text:      '#E2E8F4',
  sub:       '#94A3B8',
  muted:     '#526077',
  dim:       '#2A3A54',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Transaction  { id: string; amount: number; transaction_type: string; status: string; created_at: string; }
interface MarketAsset  { symbol: string; name: string; current_price: number; price_change_percent: number; }
interface NewsItem     { id: string; headline: string; source: string; time: string; categories: string; img: string; }

const NEWS_TABS = ['Latest', 'BTC', 'ETH', 'DeFi'];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sparkline({ positive, width = 64, height = 28 }: { positive: boolean; width?: number; height?: number }) {
  const points = positive ? [0, 18, 14, 12, 22, 8, 28, 10, 40, 4, 52, 6, 64, 2] : [0, 4, 12, 8, 24, 12, 32, 18, 44, 14, 56, 20, 64, 24];
  const pStr = points.reduce((s, v, i) => i % 2 === 0 ? s + `${v},` : s + `${v} `, '').trim();
  const c = positive ? T.green : T.red;
  return (
    <Svg width={width} height={height} viewBox={`0 0 64 28`}>
      <Polyline points={pStr} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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

const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', BNB: '#f3ba2f', XRP: '#00aae4',
  ADA: '#0033ad', DOGE: '#c3a634', AVAX: '#e84142', DOT: '#e6007a',
};
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};
const coinColor = (symbol: string) => COIN_COLORS[symbol] ?? generateColor(symbol);

function CoinSymbol({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const iconUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;

  if (failed) {
    return (
      <View style={[s.coinCircleFallback, { backgroundColor: coinColor(symbol) + '22' }]}>
        <Text style={[s.coinLetter, { color: coinColor(symbol) }]}>{symbol.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={{ uri: iconUrl }} style={s.coinImage} onError={() => setFailed(true)} />;
}

// Helper for dynamic news timestamps
const getRelativeTime = (timestamp: number) => {
  const diffInHours = Math.floor((Date.now() / 1000 - timestamp) / 3600);
  if (diffInHours < 1) return 'Just now';
  return `${diffInHours}h ago`;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  // Notice we pull the portfolio immediately from local state (it's instant)
  const { portfolio, refresh, isRefreshing } = usePortfolio();

  const [hidden,     setHidden]    = useState(false);
  const [market,     setMarket]    = useState<MarketAsset[]>([]);
  const [recentTx,   setRecentTx]  = useState<Transaction[]>([]);
  const [news,       setNews]      = useState<NewsItem[]>([]);
  
  // Track specific loading states without blocking the whole screen
  const [marketLoading, setMarketLoading] = useState(true);

  const [activeNewsTab, setActiveNewsTab] = useState('Latest');
  
  // Filter the live news feed
  const filteredNews = activeNewsTab === 'Latest' 
    ? news 
    : news.filter(n => n.categories.includes(activeNewsTab));

  // 🚨 DYNAMIC DAILY NEWS FETCH 
  const fetchLiveNews = async () => {
    try {
      const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
      const data = await res.json();
      if (data && data.Data) {
        const formatted = data.Data.slice(0, 15).map((item: any) => ({
          id: item.id,
          headline: item.title,
          source: item.source_info?.name || 'Market Update',
          time: getRelativeTime(item.published_on),
          categories: item.categories || 'Latest',
          img: item.imageurl
        }));
        setNews(formatted);
      }
    } catch (e) {
      console.log("News fetch failed, falling back to empty state.");
    }
  };

  const fetchAll = async () => {
    // Fire all requests simultaneously. Do NOT block rendering while waiting.
    refresh(); 
    fetchLiveNews();
    
    Promise.allSettled([
      apiClient.get('/wallet/history'),
      apiClient.get('/auth/me'),
      apiClient.get('/trade/market')
    ]).then(([historyRes, meRes, mktRes]) => {
      if (historyRes.status === 'fulfilled' && historyRes.value?.data) {
        setRecentTx(historyRes.value.data.slice(0, 5));
      }
      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        setUser(meRes.value.data);
      }
      if (mktRes.status === 'fulfilled' && mktRes.value?.data) {
        setMarket(mktRes.value.data.slice(0, 6));
        setMarketLoading(false);
      }
    });
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('refresh_dashboard', fetchAll);
    return () => sub.remove();
  }, []);

  // Removed the blocking full-screen loading spinner here!

  const { balances, total_equity } = portfolio;
  const fmt = (n: number) => hidden ? '••••••' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchAll} tintColor={T.gold} />}
    >
      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good day,</Text>
          {/* Failsafe to show 'Trader' if user data hasn't loaded yet */}
          <Text style={s.name}>{user?.full_name?.split(' ')[0] || 'Trader'}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/(app)/settings' as any)}>
            <Text style={s.avatarText}>{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. 4-Balance Wallet Card ───────────────────────────────────────── */}
      <View style={s.walletCard}>
        <View style={s.walletGoldBar} />
        <View style={s.walletCardInner}>
          <View style={s.walletTopRow}>
            <Text style={s.walletLabel}>TOTAL EQUITY</Text>
            <TouchableOpacity onPress={() => setHidden(h => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" />
                <Circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8" />
                {hidden && <Line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" />}
              </Svg>
            </TouchableOpacity>
          </View>

          <View style={s.balanceRow}>
            <Text style={s.balanceNum}>{fmt(total_equity || 0)}</Text>
            <View style={s.currBadge}><Text style={s.currBadgeText}>USD</Text></View>
          </View>

          {/* 4-Balance Grid */}
          <View style={s.statsGrid}>
            <View style={s.statBlock}>
              <View style={[s.statDot, { backgroundColor: T.borderSub }]} />
              <View>
                <Text style={s.statLabel}>Main Balance</Text>
                <Text style={[s.statVal, { color: T.text }]}>{fmt(balances?.main || 0)}</Text>
              </View>
            </View>
            <View style={s.statBlock}>
              <View style={[s.statDot, { backgroundColor: T.greenDim }]} />
              <View>
                <Text style={s.statLabel}>Total Profit</Text>
                <Text style={[s.statVal, { color: T.green }]}>{fmt(balances?.profit || 0)}</Text>
              </View>
            </View>
            <View style={[s.statBlock, { marginTop: 16 }]}>
              <View style={[s.statDot, { backgroundColor: T.goldDim }]} />
              <View>
                <Text style={s.statLabel}>Bonus</Text>
                <Text style={[s.statVal, { color: T.gold }]}>{fmt(balances?.bonus || 0)}</Text>
              </View>
            </View>
            <View style={[s.statBlock, { marginTop: 16 }]}>
              <View style={[s.statDot, { backgroundColor: T.blueDim }]} />
              <View>
                <Text style={s.statLabel}>Referral</Text>
                <Text style={[s.statVal, { color: T.blue }]}>{fmt(balances?.referral || 0)}</Text>
              </View>
            </View>
          </View>

          {/* Deposit / Withdraw */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.depositBtn} onPress={() => router.push('/(app)/deposit' as any)}>
              <Text style={s.depositText}>Deposit Funds</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.withdrawBtn} onPress={() => router.push('/(app)/withdraw' as any)}>
              <Text style={s.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

   
      
      {/* ── 4. Read-Only Market Ticker ─────────────────────────────────────── */}
      <View style={{ marginTop: 20 }}>
        <SectionRow title="Live Markets" onSeeAll={() => router.push('/(app)/market' as any)} />
        <View style={s.marketList}>
          {marketLoading ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={T.muted}/></View>
          ) : (
            market.map((coin, idx) => {
              const up  = coin.price_change_percent >= 0;
              return (
                <TouchableOpacity
                  key={coin.symbol}
                  style={[s.marketRow, idx === market.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.9} 
                  onPress={() => router.push('/(app)/market' as any)}
                >
                  <CoinSymbol symbol={coin.symbol} />
                  <View style={s.marketMid}>
                    <Text style={s.marketSym}>{coin.symbol}</Text>
                    <Text style={s.marketName}>{coin.name}</Text>
                  </View>
                  <Sparkline positive={up} />
                  <View style={s.marketRight}>
                    <Text style={s.marketPrice}>${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</Text>
                    <View style={[s.pctBadge, { backgroundColor: up ? T.greenDim : T.redDim }]}>
                      <Text style={[s.pctText, { color: up ? T.green : T.red }]}>{up ? '+' : ''}{coin.price_change_percent.toFixed(2)}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* ── 5. Activity Ledger ─────────────────────────────────────────────── */}
      <View style={{ marginTop: 28, marginBottom: 36 }}>
        <SectionRow title="Activity Ledger" onSeeAll={() => router.push('/(app)/deposit-history' as any)} />
        <View style={s.activityList}>
          {recentTx.length === 0 ? (
            <View style={s.emptyActivity}><Text style={s.emptyText}>No recent activity</Text></View>
          ) : (
            recentTx.map((tx, idx) => {
              const isDepo = tx.transaction_type === 'deposit';
              return (
                <View key={tx.id} style={[s.txRow, idx === recentTx.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.txIconBox, { backgroundColor: isDepo ? T.greenDim : T.redDim }]}>
                    <Ionicons name={isDepo ? 'arrow-down' : 'arrow-up'} size={18} color={isDepo ? T.green : T.red} />
                  </View>

                  <View style={s.txMid}>
                    <Text style={s.txType}>{isDepo ? 'Deposit' : 'Withdrawal'}</Text>
                    <Text style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.txAmt, { color: isDepo ? T.green : T.text }]}>
                      {isDepo ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                    </Text>
                    <Text style={s.statusText}>{tx.status}</Text>
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
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 },
  greeting:    { color: T.muted, fontSize: 13, letterSpacing: 0.3 },
  name:        { color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldDim, borderWidth: 1.5, borderColor: T.gold, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: T.gold, fontSize: 16, fontWeight: '700' },

  walletCard:      { marginHorizontal: 20, marginTop: 18, backgroundColor: T.card, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  walletGoldBar:   { height: 2.5, backgroundColor: T.gold, marginHorizontal: 0 },
  walletCardInner: { padding: 22 },
  walletTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  walletLabel:     { color: T.muted, fontSize: 10.5, letterSpacing: 2, fontWeight: '700' },
  balanceRow:      { flexDirection: 'row', alignItems: 'baseline', marginBottom: 22 },
  balanceNum:      { color: T.text, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  currBadge:       { marginLeft: 10, backgroundColor: T.goldDim, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-end', marginBottom: 6 },
  currBadgeText:   { color: T.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 18, marginBottom: 20 },
  statBlock:       { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot:         { width: 8, height: 8, borderRadius: 4 },
  statLabel:       { color: T.muted, fontSize: 11, letterSpacing: 0.3 },
  statVal:         { fontSize: 15, fontWeight: '700', marginTop: 1 },

  actionRow:       { flexDirection: 'row', gap: 10 },
  depositBtn:      { flex: 1, backgroundColor: T.gold, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  depositText:     { color: '#080C14', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  withdrawBtn:     { flex: 1, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: T.border },
  withdrawText:    { color: T.text, fontWeight: '700', fontSize: 15 },

  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 14 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDash: { width: 3, height: 16, borderRadius: 2, backgroundColor: T.gold },
  sectionTitle:{ color: T.text, fontSize: 16, fontWeight: '700' },
  seeAll:      { color: T.gold, fontSize: 13, fontWeight: '600' },

  marketList: { marginHorizontal: 20, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  marketRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSub, gap: 12 },
  coinImage:  { width: 38, height: 38, borderRadius: 19 },
  coinCircleFallback: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  coinLetter: { fontSize: 14, fontWeight: '900' },
  marketMid:  { flex: 1 },
  marketSym:  { color: T.text, fontSize: 14, fontWeight: '700' },
  marketName: { color: T.muted, fontSize: 11, marginTop: 2 },
  marketRight:{ alignItems: 'flex-end', gap: 5 },
  marketPrice:{ color: T.text, fontSize: 14, fontWeight: '700' },
  pctBadge:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pctText:    { fontSize: 11, fontWeight: '700' },

  newsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 12 },
  newsTabsContainer: { paddingHorizontal: 20, marginBottom: 16, gap: 8 },
  newsTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  newsTabActive: { backgroundColor: T.goldDim, borderColor: T.gold },
  newsTabText: { color: T.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  newsTabTextActive: { color: T.gold },

  newsCard: { width: W * 0.75, height: 200, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  newsImg: { width: '100%', height: '100%', position: 'absolute', resizeMode: 'cover' },
  newsOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.45)', justifyContent: 'flex-end', padding: 16 },
  newsMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  newsSource: { color: T.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  newsDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.text, marginHorizontal: 8 },
  newsTime: { color: T.text, fontSize: 10, fontWeight: '600', opacity: 0.8 },
  newsHeadline: { color: T.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },

  activityList:   { marginHorizontal: 20, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  emptyActivity:  { padding: 32, alignItems: 'center', gap: 10 },
  emptyText:      { color: T.muted, fontSize: 14 },
  txRow:          { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.borderSub, gap: 12 },
  txIconBox:      { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txMid:          { flex: 1 },
  txType:         { color: T.text, fontSize: 14, fontWeight: '600' },
  txDate:         { color: T.muted, fontSize: 11, marginTop: 2 },
  txAmt:          { fontSize: 15, fontWeight: '700' },
  statusText:     { fontSize: 10.5, fontWeight: '700', color: T.sub, marginTop: 4, textTransform: 'capitalize' },
});
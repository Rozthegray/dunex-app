/**
 * trade-history.tsx
 * Institutional Execution Ledger
 * Retrieves and formats real market execution logs. 
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, SafeAreaView, TouchableOpacity, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiClient } from '../../lib/apiClient';
import type { TradeExecution, TradeType } from '../../types/trading';

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF',
  BNB: '#F3BA2F', XRP: '#00AAE4',
};

function coinFromPair(pair: string) { return pair.split('/')[0] ?? pair; }
const coinColor = (pair: string) => COIN_COLORS[coinFromPair(pair)] ?? '#D4AF37';

function tradeLabel(type: TradeType) {
  switch (type) {
    case 'BUY': return { label: 'MARKET BUY', color: '#34C759', icon: 'arrow-down' as const };
    case 'SELL': return { label: 'MARKET SELL', color: '#FF3B30', icon: 'arrow-up' as const };
    case 'ACTIVE_START': return { label: 'CONTRACT OPEN', color: '#D4AF37', icon: 'flash' as const };
    case 'ACTIVE_CLOSE': return { label: 'CONTRACT CLOSED', color: '#8E8E93', icon: 'flag' as const };
    default: return { label: type, color: '#636366', icon: 'ellipse' as const };
  }
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────
type Filter = 'ALL' | 'BUY' | 'SELL' | 'ACTIVE';

function FilterTabs({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: Filter[] = ['ALL', 'BUY', 'SELL', 'ACTIVE'];
  return (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, active === tab && styles.filterTabActive]}
            onPress={() => onChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, active === tab && styles.filterTabTextActive]}>
              {tab === 'ACTIVE' ? 'CONTRACTS' : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ item }: { item: TradeExecution }) {
  const { label, color, icon } = tradeLabel(item.trade_type);
  const symbol = coinFromPair(item.pair);
  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <View style={styles.card}>
      {/* Dynamic Asset Stripe */}
      <View style={[styles.accentBar, { backgroundColor: coinColor(item.pair) }]} />

      <View style={styles.cardBody}>
        
        {/* HEADER */}
        <View style={styles.cardHeader}>
          <View style={styles.pairRow}>
            <View style={[styles.typeBadge, { borderColor: color + '40', backgroundColor: color + '10' }]}>
              <Ionicons name={icon} size={10} color={color} />
              <Text style={[styles.typeText, { color }]}>{label}</Text>
            </View>
            <Text style={styles.pairText}>{item.pair}</Text>
          </View>
          <Text style={styles.dateText}>{dateStr} {timeStr}</Text>
        </View>

        {/* EXECUTION STATS */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EXECUTION PRICE</Text>
            <Text style={styles.statValue}>
              {item.entry_price > 0
                ? `$${item.entry_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
                : '—'}
            </Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>NOTIONAL (USD)</Text>
            <Text style={styles.statValue}>
              {item.amount_usd > 0 ? `$${item.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
            </Text>
          </View>
          
          <View style={[styles.statBox, { alignItems: 'flex-end' }]}>
            <Text style={styles.statLabel}>FILLED ({symbol})</Text>
            <Text style={[styles.statValue, { color: coinColor(item.pair) }]}>
              {item.amount_crypto !== 0
                ? `${item.amount_crypto > 0 ? '+' : ''}${item.amount_crypto.toFixed(6)}`
                : '—'}
            </Text>
          </View>
        </View>

        {/* STATUS FOOTER */}
        <View style={styles.cardFooter}>
          <Text style={styles.refText}>ID: {item.id.split('-')[0].toUpperCase()}</Text>
          <View style={[
            styles.statusBadge,
            { 
              backgroundColor: item.status === 'completed' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(212, 175, 55, 0.1)',
              borderColor: item.status === 'completed' ? 'rgba(52, 199, 89, 0.3)' : 'rgba(212, 175, 55, 0.3)'
            }
          ]}>
            <Text style={[
              styles.statusText,
              { color: item.status === 'completed' ? '#34C759' : '#D4AF37' }
            ]}>
              {item.status === 'completed' ? 'SETTLED' : 'PENDING'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TradeHistoryScreen() {
  const [trades, setTrades] = useState<TradeExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const fetchTrades = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.get<TradeExecution[]>('/trade/history');
      setTrades(res.data);
    } catch (err) {
      console.error('Failed to sync execution ledger:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTrades(); }, [fetchTrades]));
  const onRefresh = () => fetchTrades(true);

  const filtered = trades.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return t.trade_type.startsWith('ACTIVE');
    return t.trade_type === filter;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerGreeting}>MARKET DATA</Text>
        <Text style={styles.headerTitle}>EXECUTION LEDGER</Text>
        <Text style={styles.headerSub}>{trades.length} SETTLED RECORDS</Text>
      </View>

      <FilterTabs active={filter} onChange={setFilter} />

      {/* LEDGER LIST */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TradeCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="documents-outline" size={48} color="#1E1E28" />
            <Text style={styles.emptyText}>NO EXECUTIONS FOUND</Text>
            <Text style={styles.emptySub}>
              {filter !== 'ALL' ? `No ${filter} orders logged.` : 'Market orders will appear here upon settlement.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' }, // Pitch black
  center: { flex: 1, backgroundColor: '#05050A', justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30, paddingBottom: 16 },
  headerGreeting: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 8 },

  filterContainer: { borderBottomWidth: 1, borderBottomColor: '#1E1E28', paddingBottom: 16, marginBottom: 16 },
  filterRow: { paddingHorizontal: 20, gap: 10 },
  filterTab: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#05050A', borderWidth: 1, borderColor: '#1E1E28',
    justifyContent: 'center', alignItems: 'center'
  },
  filterTabActive: { backgroundColor: 'rgba(212, 175, 55, 0.05)', borderColor: '#D4AF37' },
  filterTabText: { color: '#636366', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  filterTabTextActive: { color: '#D4AF37' },

  listContent: { paddingHorizontal: 20, paddingBottom: 100 }, // Space for bottom nav

  card: {
    flexDirection: 'row', backgroundColor: '#12121A', borderRadius: 20,
    marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1E1E28',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 18 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  typeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  pairText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  dateText: { color: '#636366', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#05050A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28' },
  statBox: { flex: 1 },
  statLabel: { color: '#636366', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: '#E5E5EA', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E1E28' },
  refText: { color: '#636366', fontSize: 10, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginTop: 16 },
  emptySub: { color: '#636366', fontSize: 12, marginTop: 8, textAlign: 'center', fontWeight: '500', paddingHorizontal: 30, lineHeight: 18 },
});
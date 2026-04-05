

/**
 * deposit-history.tsx  (Unified Transaction History)
 * Shows all ledger transactions (deposits + withdrawals) with filter tabs.
 * Pull-to-refresh, status colour coding, and reference display.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiClient } from '../../lib/apiClient';
import type { LedgerTransaction, TransactionType } from '../../types/trading';

type Filter = 'ALL' | 'deposit' | 'withdrawal';

const STATUS_COLORS = {
  completed: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
};

const TX_CONFIG = {
  deposit: { label: 'Deposit', icon: 'arrow-down-outline' as const, color: '#10b981', sign: '+' },
  withdrawal: { label: 'Withdrawal', icon: 'arrow-up-outline' as const, color: '#ef4444', sign: '-' },
};

// ─── Transaction Card ─────────────────────────────────────────────────────────
function TxCard({ item }: { item: LedgerTransaction }) {
  // Create a mutable copy of the config so we can override it based on wallet_type
  let cfg = { ...(TX_CONFIG[item.transaction_type as keyof typeof TX_CONFIG] ?? TX_CONFIG.deposit) };

  // 🚨 NEW: Special Wallet Logic
  if (item.transaction_type === 'deposit') {
    const wType = (item as any).wallet_type || 'main';
    
    if (wType === 'bonus') {
      cfg.label = 'Bonus Received';
      cfg.color = '#C9A84C'; // Gold
      cfg.icon = 'gift-outline' as any;
    } else if (wType === 'referral') {
      cfg.label = 'Referral Reward';
      cfg.color = '#3B82F6'; // Blue
      cfg.icon = 'people-outline' as any;
    } else if (wType === 'profit') {
      cfg.label = 'Profit Distribution';
      cfg.color = '#10b981'; // Green
      cfg.icon = 'trending-up-outline' as any;
    }
  }

  const statusColor = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] ?? '#64748b';
  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + '22' }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* Details */}
      <View style={styles.cardMid}>
        <Text style={styles.cardTitle}>{cfg.label}</Text>
        <Text style={styles.cardRef}>
          {item.reference} · {timeStr}
        </Text>
        <Text style={styles.cardDate}>{dateStr}</Text>
      </View>

      {/* Amount + status */}
      <View style={styles.cardRight}>
        <Text style={[styles.cardAmount, { color: cfg.color }]}>
          {cfg.sign}${Math.abs(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ txs }: { txs: LedgerTransaction[] }) {
  // 1. REAL DEPOSITS: Strictly checks for the 'main' wallet type
  const deposited = txs
    .filter(t => t.transaction_type === 'deposit' && t.status === 'completed' && ((t as any).wallet_type || 'main') === 'main')
    .reduce((s, t) => s + t.amount, 0);

  // 2. EARNINGS: Groups bonuses, profits, and referrals together
  const earned = txs
    .filter(t => t.transaction_type === 'deposit' && t.status === 'completed' && ['bonus', 'profit', 'referral'].includes((t as any).wallet_type))
    .reduce((s, t) => s + t.amount, 0);

  // 3. WITHDRAWALS
  const withdrawn = txs
    .filter(t => t.transaction_type === 'withdrawal' && t.status === 'completed')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <View style={styles.summaryRow}>
      
      {/* Deposited Column */}
      <View style={[styles.summaryItem, { alignItems: 'flex-start' }]}>
        <Text style={styles.summaryLabel}>Deposited</Text>
        <Text style={[styles.summaryValue, { color: '#10b981' }]} numberOfLines={1} adjustsFontSizeToFit>
          +${deposited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.summaryDivider} />

      {/* Earned Column */}
      <View style={[styles.summaryItem, { alignItems: 'center' }]}>
        <Text style={styles.summaryLabel}>Earned</Text>
        <Text style={[styles.summaryValue, { color: '#3b82f6' }]} numberOfLines={1} adjustsFontSizeToFit>
          +${earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.summaryDivider} />

      {/* Withdrawn Column */}
      <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
        <Text style={styles.summaryLabel}>Withdrawn</Text>
        <Text style={[styles.summaryValue, { color: '#ef4444' }]} numberOfLines={1} adjustsFontSizeToFit>
          -${withdrawn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TransactionHistoryScreen() {
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.get<LedgerTransaction[]>('/wallet/history');
      setTxs(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchHistory(); }, [fetchHistory]));
  const onRefresh = () => fetchHistory(true);

  const filtered = filter === 'ALL' ? txs : txs.filter(t => t.transaction_type === filter);

  const filters: Filter[] = ['ALL', 'deposit', 'withdrawal'];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerSub}>{txs.length} total records</Text>
      </View>

      {txs.length > 0 && <SummaryStrip txs={txs} />}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'ALL' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TxCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>Your deposit and withdrawal history will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#475569', fontSize: 14, marginTop: 4 },

  summaryRow: {
    flexDirection: 'row', backgroundColor: '#111827', marginHorizontal: 20,
    borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center',
  },
  summaryItem: { flex: 1 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#1e293b' },
 summaryLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '900' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterTab: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b',
  },
  filterTabActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterTabText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  filterTabTextActive: { color: '#fff' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b',
  },
  iconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardMid: { flex: 1 },
  cardTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  cardRef: { color: '#475569', fontSize: 11, fontFamily: 'monospace' },
  cardDate: { color: '#334155', fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 17, fontWeight: '900', marginBottom: 5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#e2e8f0', fontSize: 18, fontWeight: '800', marginTop: 14 },
  emptySub: { color: '#475569', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
});

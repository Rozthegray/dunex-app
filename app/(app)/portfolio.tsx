/**
 * portfolio.tsx
 * Institutional Wealth Ledger (4-Balance System)
 * Displays Aggregate Net Worth and the breakdown of the 4 admin-controlled wallets.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, SafeAreaView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePortfolio } from '../../hooks/usePortfolio';

export default function PortfolioScreen() {
  const { portfolio, isLoading, isRefreshing, refresh } = usePortfolio();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  const { balances, total_equity } = portfolio;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#D4AF37" />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerGreeting}>PRIVATE LEDGER</Text>
          <Text style={styles.headerTitle}>ASSET BREAKDOWN</Text>
        </View>

        {/* AGGREGATE NET WORTH CARD */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>AGGREGATE EQUITY</Text>
          <View style={styles.mainBalanceRow}>
            <Text style={styles.mainCurrency}>$</Text>
            <Text style={styles.totalAmount}>
              {total_equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          
          <View style={styles.totalDivider} />

          {/* ACTION BUTTONS */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnGold} onPress={() => router.push('/(app)/deposit' as any)}>
              <Ionicons name="arrow-down-outline" size={16} color="#05050A" />
              <Text style={styles.actionTextDark}>DEPOSIT FUNDS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnDark} onPress={() => router.push('/(app)/withdraw' as any)}>
              <Ionicons name="arrow-up-outline" size={16} color="#D4AF37" />
              <Text style={styles.actionTextGold}>WITHDRAW</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4-BALANCE VAULT BREAKDOWN */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>VAULT ALLOCATION</Text>
          <Ionicons name="lock-closed" size={14} color="#636366" />
        </View>

        <View style={styles.listContainer}>
          {/* Main Balance */}
          <View style={[styles.assetCard, styles.borderBottom]}>
            <View style={styles.assetLeft}>
              <View style={[styles.iconCircle, { borderColor: '#3B82F650', backgroundColor: '#3B82F610' }]}>
                <Ionicons name="wallet" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.assetSymbol}>Main Balance</Text>
                <Text style={styles.assetBalance}>Available for withdrawal</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetValue}>${balances.main.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Profit Balance */}
          <View style={[styles.assetCard, styles.borderBottom]}>
            <View style={styles.assetLeft}>
              <View style={[styles.iconCircle, { borderColor: '#10B98150', backgroundColor: '#10B98110' }]}>
                <Ionicons name="trending-up" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.assetSymbol}>Total Profit</Text>
                <Text style={styles.assetBalance}>Generated returns</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetValue}>${balances.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Bonus Balance */}
          <View style={[styles.assetCard, styles.borderBottom]}>
            <View style={styles.assetLeft}>
              <View style={[styles.iconCircle, { borderColor: '#D4AF3750', backgroundColor: '#D4AF3710' }]}>
                <Ionicons name="gift" size={18} color="#D4AF37" />
              </View>
              <View>
                <Text style={styles.assetSymbol}>Active Bonus</Text>
                <Text style={styles.assetBalance}>Platform rewards</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetValue}>${balances.bonus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Referral Balance */}
          <View style={styles.assetCard}>
            <View style={styles.assetLeft}>
              <View style={[styles.iconCircle, { borderColor: '#A855F750', backgroundColor: '#A855F710' }]}>
                <Ionicons name="people" size={18} color="#A855F7" />
              </View>
              <View>
                <Text style={styles.assetSymbol}>Referral Network</Text>
                <Text style={styles.assetBalance}>Affiliate earnings</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetValue}>${balances.referral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  container: { flex: 1, backgroundColor: '#05050A' },
  center: { flex: 1, backgroundColor: '#05050A', justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30, paddingBottom: 20 },
  headerGreeting: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  totalCard: {
    marginHorizontal: 20, backgroundColor: '#12121A', borderRadius: 24,
    padding: 24, marginBottom: 30, borderWidth: 1, borderColor: '#1E1E28',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10
  },
  totalLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  mainBalanceRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, marginBottom: 20 },
  mainCurrency: { color: '#D4AF37', fontSize: 24, fontWeight: '700', marginRight: 4, marginTop: 4 },
  totalAmount: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  totalDivider: { height: 1, backgroundColor: '#1E1E28', marginBottom: 20 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtnGold: { flex: 1, backgroundColor: '#D4AF37', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  actionTextDark: { color: '#05050A', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnDark: { flex: 1, backgroundColor: '#05050A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#D4AF37' },
  actionTextGold: { color: '#D4AF37', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  listContainer: { backgroundColor: '#12121A', borderRadius: 20, marginHorizontal: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 30 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#1E1E28' },

  assetCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  assetLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  assetSymbol: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  assetBalance: { color: '#8E8E93', fontSize: 11, fontWeight: '600' },
  
  assetRight: { alignItems: 'flex-end', paddingRight: 10 },
  assetValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
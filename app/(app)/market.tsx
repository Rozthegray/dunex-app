/**
 * market.tsx
 * Live crypto market list powered by CoinMarketCap (via backend proxy).
 * Users browse live prices and BUY coins to populate their sub-wallets.
 * Flow: Market → Tap coin → Enter USD amount → Confirm → Sub-wallet credited.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, RefreshControl,
  SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarketData } from '../../hooks/useMarketData';
import { usePortfolio } from '../../hooks/usePortfolio';
import type { MarketAsset } from '../../types/trading';

// ─── Coin colour map ────────────────────────────────────────────────────────
const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff',
  BNB: '#f3ba2f', XRP: '#00aae4', ADA: '#0033ad',
  DOGE: '#c3a634', AVAX: '#e84142', DOT: '#e6007a',
  MATIC: '#8247e5', LTC: '#bfbbbb', LINK: '#2a5ada',
};
const coinColor = (symbol: string) => COIN_COLORS[symbol] ?? '#3b82f6';

// ─── Sub-components ──────────────────────────────────────────────────────────
function CoinSymbol({ symbol }: { symbol: string }) {
  return (
    <View style={[styles.coinCircle, { backgroundColor: coinColor(symbol) + '22' }]}>
      <Text style={[styles.coinLetter, { color: coinColor(symbol) }]}>
        {symbol.slice(0, 2)}
      </Text>
    </View>
  );
}

function PriceChangeTag({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <View style={[styles.changeBadge, { backgroundColor: up ? '#10b98122' : '#ef444422' }]}>
      <Ionicons name={up ? 'caret-up' : 'caret-down'} size={10} color={up ? '#10b981' : '#ef4444'} />
      <Text style={[styles.changeText, { color: up ? '#10b981' : '#ef4444' }]}>
        {Math.abs(pct).toFixed(2)}%
      </Text>
    </View>
  );
}

// ─── Buy Modal ───────────────────────────────────────────────────────────────
interface BuyModalProps {
  asset: MarketAsset | null;
  usdBalance: number;
  visible: boolean;
  onClose: () => void;
  onConfirm: (symbol: string, amountUsd: number) => Promise<void>;
}

function BuyModal({ asset, usdBalance, visible, onClose, onConfirm }: BuyModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setAmount(''); onClose(); };

  const cryptoPreview = asset && parseFloat(amount) > 0
    ? (parseFloat(amount) / asset.current_price).toFixed(8)
    : '0.00000000';

  const handleConfirm = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return Alert.alert('Invalid Amount', 'Enter a valid USD amount.');
    if (val > usdBalance) return Alert.alert('Insufficient Funds', `Your USD balance is $${usdBalance.toFixed(2)}.`);
    setLoading(true);
    try {
      await onConfirm(asset!.symbol, val);
      handleClose();
      Alert.alert('Purchase Successful ✅', `${cryptoPreview} ${asset!.symbol} added to your sub-wallet.`);
    } catch (err: any) {
      Alert.alert('Trade Failed', err.response?.data?.detail ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <CoinSymbol symbol={asset?.symbol ?? ''} />
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.modalTitle}>Buy {asset?.symbol}</Text>
              <Text style={styles.modalPrice}>
                1 {asset?.symbol} = ${asset?.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Balance info */}
          <View style={styles.balancePill}>
            <Ionicons name="wallet-outline" size={14} color="#94a3b8" />
            <Text style={styles.balancePillText}>
              Available: <Text style={styles.balancePillAmount}>${usdBalance.toFixed(2)} USD</Text>
            </Text>
          </View>

          {/* Amount input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>Amount in USD</Text>
            <View style={styles.inputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountField}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#475569"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* Crypto preview */}
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>You will receive</Text>
            <Text style={[styles.previewValue, { color: coinColor(asset?.symbol ?? '') }]}>
              ≈ {cryptoPreview} {asset?.symbol}
            </Text>
          </View>

          {/* Quick amount chips */}
          <View style={styles.quickRow}>
            {[25, 50, 100, 250].map(v => (
              <TouchableOpacity key={v} style={styles.quickChip} onPress={() => setAmount(String(v))}>
                <Text style={styles.quickChipText}>${v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: coinColor(asset?.symbol ?? '') }, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm Buy</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MarketScreen() {
  const { assets, isLoading, isRefreshing, lastUpdated, refresh } = useMarketData();
  const { portfolio, executeTrade } = usePortfolio();
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
  const [search, setSearch] = useState('');

  const filtered = assets.filter(a =>
    a.symbol.includes(search.toUpperCase()) || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBuy = async (symbol: string, amountUsd: number) => {
    await executeTrade({ symbol, amount_usd: amountUsd, trade_type: 'BUY' });
  };

  const renderAsset = ({ item }: { item: MarketAsset }) => (
    <TouchableOpacity style={styles.assetRow} onPress={() => setSelectedAsset(item)} activeOpacity={0.75}>
      <CoinSymbol symbol={item.symbol} />
      <View style={styles.assetMid}>
        <Text style={styles.assetSymbol}>{item.symbol}</Text>
        <Text style={styles.assetName}>{item.name}</Text>
      </View>
      <View style={styles.assetRight}>
        <Text style={styles.assetPrice}>
          ${item.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: item.current_price > 1 ? 2 : 6 })}
        </Text>
        <PriceChangeTag pct={item.price_change_percent} />
      </View>
      <TouchableOpacity
        style={[styles.buyChip, { backgroundColor: coinColor(item.symbol) + '22', borderColor: coinColor(item.symbol) + '55' }]}
        onPress={() => setSelectedAsset(item)}
      >
        <Text style={[styles.buyChipText, { color: coinColor(item.symbol) }]}>BUY</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </View>
        <View style={styles.walletPill}>
          <Ionicons name="wallet-outline" size={14} color="#94a3b8" />
          <Text style={styles.walletPillText}>${portfolio.usd_balance.toFixed(2)}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#475569" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search coins..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#475569" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Fetching live prices…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.symbol}
          renderItem={renderAsset}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color="#475569" />
              <Text style={styles.emptyText}>No coins match "{search}"</Text>
            </View>
          }
        />
      )}

      {/* Buy Modal */}
      <BuyModal
        asset={selectedAsset}
        usdBalance={portfolio.usd_balance}
        visible={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onConfirm={handleBuy}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#475569', fontSize: 11, marginTop: 2 },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#334155',
  },
  walletPillText: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', marginHorizontal: 20, marginBottom: 16,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 16 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  assetRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e293b',
  },
  coinCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  coinLetter: { fontSize: 14, fontWeight: '900' },

  assetMid: { flex: 1 },
  assetSymbol: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  assetName: { color: '#64748b', fontSize: 12, marginTop: 2 },

  assetRight: { alignItems: 'flex-end', marginRight: 10 },
  assetPrice: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', marginBottom: 4 },

  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  changeText: { fontSize: 11, fontWeight: '700' },

  buyChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  buyChipText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { color: '#475569', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#475569', marginTop: 12, fontSize: 16 },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111827', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, borderWidth: 1, borderColor: '#1e293b', borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#334155',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
  modalPrice: { color: '#64748b', fontSize: 13, marginTop: 2 },

  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#334155',
  },
  balancePillText: { color: '#94a3b8', fontSize: 13 },
  balancePillAmount: { color: '#e2e8f0', fontWeight: '700' },

  inputBlock: { marginBottom: 12 },
  inputLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0f1e', borderRadius: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  dollarSign: { color: '#3b82f6', fontSize: 28, fontWeight: '900', marginRight: 8 },
  amountField: { flex: 1, color: '#f1f5f9', fontSize: 32, fontWeight: '900', paddingVertical: 14 },

  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1e293b', padding: 14, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  previewLabel: { color: '#64748b', fontSize: 13 },
  previewValue: { fontSize: 14, fontWeight: '800' },

  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickChip: {
    flex: 1, backgroundColor: '#1e293b', paddingVertical: 10,
    borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  quickChipText: { color: '#94a3b8', fontWeight: '700', fontSize: 14 },

  modalBtns: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#1e293b', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  cancelBtnText: { color: '#94a3b8', fontWeight: '700', fontSize: 16 },
  confirmBtn: { flex: 1.5, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

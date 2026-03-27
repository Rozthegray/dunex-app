/**
 * portfolio.tsx
 * Institutional Wealth Ledger
 * Displays Aggregate Net Worth (Fiat + Digital), segmented asset allocation,
 * and features a high-security liquidation modal.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Modal, TextInput, Alert, SafeAreaView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePortfolio } from '../../hooks/usePortfolio';
import type { SubWallet } from '../../types/trading';

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF',
  BNB: '#F3BA2F', XRP: '#00AAE4', ADA: '#0033AD',
  DOGE: '#C3A634', AVAX: '#E84142', DOT: '#E6007A',
};
const coinColor = (s: string) => COIN_COLORS[s] ?? '#D4AF37'; // Default to Gold if unknown

// ─── High-Security Liquidation Modal ──────────────────────────────────────────
interface SellModalProps {
  asset: SubWallet | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (symbol: string, amountUsd: number) => Promise<void>;
}

function SellModal({ asset, visible, onClose, onConfirm }: SellModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setAmount(''); onClose(); };

  const cryptoSold = asset && parseFloat(amount) > 0
    ? (parseFloat(amount) / asset.current_price).toFixed(8)
    : '0.00000000';

  const maxUsd = asset ? (asset.balance * asset.current_price).toFixed(2) : '0';

  const handleConfirm = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return Alert.alert('Invalid Directive', 'Enter a valid USD settlement amount.');
    if (asset && val > asset.value_usd) return Alert.alert('Insufficient Asset', `Maximum liquidation is $${maxUsd}.`);
    
    setLoading(true);
    try {
      await onConfirm(asset!.symbol, val);
      handleClose();
      Alert.alert('LIQUIDATION AUTHORIZED', `$${val.toFixed(2)} has been settled to your Fiat Reserves.`);
    } catch (err: any) {
      Alert.alert('Transmission Failed', err.response?.data?.detail ?? 'Failed to execute market order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AUTHORIZE LIQUIDATION</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSub}>
            VAULT BALANCE: <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{asset?.balance.toFixed(8)} {asset?.symbol}</Text> ≈ <Text style={{ color: '#D4AF37' }}>${maxUsd}</Text>
          </Text>

          <Text style={styles.inputLabel}>SETTLEMENT AMOUNT (USD)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountField}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#636366"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(maxUsd)}>
              <Text style={styles.maxBtnText}>MAX</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>ASSET DEDUCTION</Text>
            <Text style={[styles.previewValue, { color: '#FF3B30' }]}>
              -{cryptoSold} {asset?.symbol}
            </Text>
          </View>

          <TouchableOpacity style={[styles.sellConfirmBtn, loading && { opacity: 0.5 }]} onPress={handleConfirm} disabled={loading}>
            {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.sellConfirmBtnText}>EXECUTE MARKET SELL</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PortfolioScreen() {
  const { portfolio, isLoading, isRefreshing, refresh, executeTrade } = usePortfolio();
  const [selectedAsset, setSelectedAsset] = useState<SubWallet | null>(null);
  const router = useRouter();

  const totalValue = portfolio.total_value_usd;

  const handleSell = async (symbol: string, amountUsd: number) => {
    await executeTrade({ symbol, amount_usd: amountUsd, trade_type: 'SELL' });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#D4AF37" />}
          contentContainerStyle={{ paddingBottom: 100 }} // Tab bar spacing
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerGreeting}>PRIVATE ASSETS</Text>
            <Text style={styles.headerTitle}>TOTAL ASSETS</Text>
          </View>

          {/* AGGREGATE NET WORTH CARD */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>AGGREGATE NET WORTH</Text>
            <View style={styles.mainBalanceRow}>
              <Text style={styles.mainCurrency}>$</Text>
              <Text style={styles.totalAmount}>
                {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            
            <View style={styles.totalDivider} />
            
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalSubLabel}>FIAT RESERVES</Text>
                <Text style={styles.totalSubValue}>
                  ${portfolio.usd_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.totalSubLabel}>DIGITAL HOLDINGS</Text>
                <Text style={[styles.totalSubValue, { color: '#D4AF37' }]}>
                  ${(totalValue - portfolio.usd_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtnGold} onPress={() => router.push('/(app)/deposit' as any)}>
                <Ionicons name="arrow-down-outline" size={16} color="#05050A" />
                <Text style={styles.actionTextDark}>DEPOSIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnDark} onPress={() => router.push('/(app)/withdraw' as any)}>
                <Ionicons name="arrow-up-outline" size={16} color="#D4AF37" />
                <Text style={styles.actionTextGold}>WITHDRAW</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnMuted} onPress={() => router.push('/(app)/market' as any)}>
                <Ionicons name="add-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionTextWhite}>ACQUIRE</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* VAULTED ASSETS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>VAULTED ASSETS</Text>
            <Ionicons name="lock-closed" size={14} color="#636366" />
          </View>

          <View style={styles.listContainer}>
            {portfolio.assets.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark-outline" size={48} color="#1E1E28" />
                <Text style={styles.emptyText}>VAULT EMPTY</Text>
                <Text style={styles.emptySub}>No digital assets currently secured in cold storage. Proceed to markets to acquire holdings.</Text>
                <TouchableOpacity style={styles.buyNowBtn} onPress={() => router.push('/(app)/market' as any)}>
                  <Text style={styles.buyNowText}>BROWSE MARKETS</Text>
                </TouchableOpacity>
              </View>
            ) : (
              portfolio.assets.map((asset, i) => {
                const color = coinColor(asset.symbol);
                const pct = totalValue > 0 ? (asset.value_usd / totalValue) * 100 : 0;
                
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.assetCard, i !== portfolio.assets.length - 1 && styles.borderBottom]}
                    onPress={() => setSelectedAsset(asset)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assetLeft}>
                      <View style={[styles.coinCircle, { borderColor: color + '50' }]}>
                        <Text style={[styles.coinLetter, { color }]}>{asset.symbol.slice(0, 2)}</Text>
                      </View>
                      <View>
                        <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                        <Text style={styles.assetBalance}>{asset.balance.toFixed(6)} {asset.symbol}</Text>
                      </View>
                    </View>

                    <View style={styles.assetRight}>
                      <Text style={styles.assetValue}>
                        ${asset.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.assetPrice}>@ ${asset.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    </View>

                    {/* Liquidate Indicator */}
                    <View style={styles.liquidateArrow}>
                      <Ionicons name="chevron-forward" size={16} color="#636366" />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* SELL MODAL */}
      <SellModal
        asset={selectedAsset}
        visible={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onConfirm={handleSell}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' }, // Pitch black
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  totalSubLabel: { color: '#636366', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  totalSubValue: { color: '#E5E5EA', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtnGold: { flex: 1, backgroundColor: '#D4AF37', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  actionTextDark: { color: '#05050A', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnDark: { flex: 1, backgroundColor: '#05050A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#D4AF37' },
  actionTextGold: { color: '#D4AF37', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnMuted: { flex: 1, backgroundColor: '#1E1E28', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  actionTextWhite: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  listContainer: { backgroundColor: '#12121A', borderRadius: 20, marginHorizontal: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 30 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#1E1E28' },

  assetCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  assetLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  coinCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, backgroundColor: '#05050A' },
  coinLetter: { fontSize: 14, fontWeight: '900' },
  assetSymbol: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  assetBalance: { color: '#8E8E93', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  
  assetRight: { alignItems: 'flex-end', paddingRight: 10 },
  assetValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 2, fontVariant: ['tabular-nums'] },
  assetPrice: { color: '#636366', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liquidateArrow: { justifyContent: 'center', alignItems: 'center' },

  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginTop: 16 },
  emptySub: { color: '#636366', fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 18, paddingHorizontal: 20 },
  buyNowBtn: { backgroundColor: '#1E1E28', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  buyNowText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.9)', justifyContent: 'center', paddingHorizontal: 20 },
  modalSheet: { backgroundColor: '#12121A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E1E28', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  modalSub: { color: '#8E8E93', fontSize: 12, fontWeight: '600', marginBottom: 24, letterSpacing: 0.5 },
  
  inputLabel: { color: '#636366', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#05050A', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 20, height: 64 },
  dollarSign: { color: '#D4AF37', fontSize: 24, fontWeight: '900', marginRight: 8 },
  amountField: { flex: 1, color: '#FFFFFF', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  maxBtn: { backgroundColor: '#1E1E28', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  maxBtnText: { color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#05050A', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#1E1E28' },
  previewLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  previewValue: { fontWeight: '900', fontSize: 12, fontVariant: ['tabular-nums'] },
  
  sellConfirmBtn: { backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  sellConfirmBtnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
});
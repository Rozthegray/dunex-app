/**
 * withdraw.tsx
 * Institutional Capital Extraction (Outbound Wire)
 * Features structured settlement routing, optimistic UI deduction, and high-security authorization.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Modal, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import type { MainWallet } from '../../types/trading';

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];
const ACCOUNT_TYPES = ['Crypto', 'Bank Transfer', 'e-Wallet'];

export default function WithdrawScreen() {
  const router = useRouter();
  
  // Extraction Data State
  const [amount, setAmount] = useState('');
  const [accountType, setAccountType] = useState('Crypto');
  const [accountName, setAccountName] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  const [wallet, setWallet] = useState<MainWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);

  // High-Security Success Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [successData, setSuccessData] = useState({ amount: 0, reference: '' });

  useEffect(() => {
    apiClient.get<MainWallet>('/wallet/my-wallet')
      .then(res => setWallet(res.data))
      .catch(() => {})
      .finally(() => setWalletLoading(false));
  }, []);

  const handleWithdraw = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return Alert.alert('Invalid Directive', 'Enter a valid extraction amount.');
    
    if (!accountName.trim()) return Alert.alert('Beneficiary Required', "Please provide the receiving entity's name.");
    if (!accountDetails.trim()) return Alert.alert('Routing Required', 'Please provide the destination ledger or account number.');
    
    if (wallet && val > wallet.cached_balance) {
      return Alert.alert('Insufficient Liquidity', `Maximum cleared reserve is $${wallet.cached_balance.toFixed(2)}.`);
    }

    const formattedDestination = `[${accountType.toUpperCase()}] Name: ${accountName.trim()} | Details: ${accountDetails.trim()}`;

    setLoading(true);
    try {
      const res = await apiClient.post('/wallet/withdraw', { 
        amount: val, 
        currency: 'USD',
        destination_details: formattedDestination 
      });
      
      // INSTANT UI UPDATE: Deduct balance immediately
      if (wallet) {
        setWallet({ ...wallet, cached_balance: wallet.cached_balance - val });
      }

      setSuccessData({ amount: val, reference: res.data.reference });
      setModalVisible(true);

      setAmount('');
      setAccountName('');
      setAccountDetails('');
      
    } catch (err: any) {
      Alert.alert('Transmission Failed', err.response?.data?.detail ?? 'Failed to authorize outbound wire.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    router.back(); 
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerGreeting}>FAST PAYOUTT</Text>
            <Text style={styles.headerTitle}>WITHDRAWAL</Text>
            <Text style={styles.subtitle}>Settlement requires secondary clearance by the treasury team.</Text>
          </View>

          {/* LIQUIDITY CARD */}
          <View style={styles.balanceCard}>
            {walletLoading ? (
              <ActivityIndicator color="#D4AF37" />
            ) : (
              <>
                <Text style={styles.balanceLabel}>CLEARED ASSETS</Text>
                <Text style={styles.balanceAmount}>
                  ${wallet?.cached_balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
                </Text>
              </>
            )}
          </View>

          {/* AMOUNT CARD */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>EXTRACTION AMOUNT (USD)</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#636366"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setAmount(String(q))} activeOpacity={0.7}>
                  <Text style={styles.quickChipText}>{q >= 1000 ? `${q / 1000}k` : q}</Text>
                </TouchableOpacity>
              ))}
              {wallet && wallet.cached_balance > 0 && (
                <TouchableOpacity
                  style={[styles.quickChip, { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' }]}
                  onPress={() => setAmount(wallet.cached_balance.toFixed(2))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickChipText, { color: '#D4AF37' }]}>MAX</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SETTLEMENT ROUTING FORM */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionLabel}>SETTLEMENT RAIL</Text>
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map(type => {
                const isActive = accountType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, isActive && styles.typeChipActive]}
                    onPress={() => setAccountType(type)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeChipText, isActive && styles.typeTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>BENEFICIARY ENTITY</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Pierce & Pierce Holdings"
              placeholderTextColor="#636366"
              value={accountName}
              onChangeText={setAccountName}
            />

            <Text style={styles.sectionLabel}>
              {accountType === 'Crypto' ? 'DESTINATION LEDGER (ADDRESS)' : accountType === 'Bank Transfer' ? 'ROUTING & ACCOUNT NUMBER' : 'E-WALLET IDENTIFIER'}
            </Text>
            <TextInput
              style={[styles.inputField, { minHeight: 80 }]}
              multiline
              numberOfLines={3}
              placeholder={
                accountType === 'Crypto' ? "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" :
                accountType === 'Bank Transfer' ? "Chase Bank\nACCT: 123456789\nROUTING: 987654321" :
                "$PatrickBateman / patrick@wallstreet.com"
              }
              placeholderTextColor="#636366"
              value={accountDetails}
              onChangeText={setAccountDetails}
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.destHint}>
            <Ionicons name="lock-closed" size={10} color="#636366" /> END-TO-END ENCRYPTED ROUTING
          </Text>

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleWithdraw}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#05050A" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>AUTHORIZE EXTRACTION</Text>
                <Ionicons name="shield-checkmark" size={16} color="#05050A" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* INSTITUTIONAL SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={48} color="#D4AF37" />
            </View>
            <Text style={styles.modalTitle}>WIRE AUTHORIZED</Text>
            <Text style={styles.modalMessage}>
              Your extraction request for <Text style={{ color: '#FFFFFF', fontWeight: '900', fontVariant: ['tabular-nums'] }}>${successData.amount.toFixed(2)}</Text> has been routed to the treasury clearance queue.
            </Text>
            
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>SECURE TRACKING ID</Text>
              <Text style={styles.refText}>{successData.reference}</Text>
            </View>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={handleCloseModal} activeOpacity={0.8}>
              <Text style={styles.modalDoneText}>ACKNOWLEDGE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' }, // Pitch black
  scroll: { padding: 20 },

  header: { marginTop: Platform.OS === 'ios' ? 10 : 20, marginBottom: 30 },
  headerGreeting: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#8E8E93', fontSize: 12, marginTop: 8, fontWeight: '500', lineHeight: 18 },

  balanceCard: {
    backgroundColor: '#12121A', borderRadius: 20, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#1E1E28', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10
  },
  balanceLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  balanceAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },

  amountCard: { backgroundColor: '#12121A', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#1E1E28' },
  amountLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1E28', paddingBottom: 16 },
  dollarSign: { color: '#D4AF37', fontSize: 36, fontWeight: '900', marginRight: 12 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 44, fontWeight: '900', paddingVertical: 0, fontVariant: ['tabular-nums'] },
  
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 20, flexWrap: 'wrap' },
  quickChip: { flex: 1, minWidth: '20%', backgroundColor: '#05050A', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E1E28', alignItems: 'center' },
  quickChipText: { color: '#8E8E93', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  formContainer: {
    backgroundColor: '#12121A', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 16
  },
  sectionLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  typeChip: { 
    flex: 1, paddingVertical: 14, borderRadius: 12, 
    borderWidth: 1, borderColor: '#1E1E28', backgroundColor: '#05050A', 
    alignItems: 'center' 
  },
  typeChipActive: { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' },
  typeChipText: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  typeTextActive: { color: '#D4AF37' },

  inputField: {
    backgroundColor: '#05050A', color: '#FFFFFF', padding: 16,
    borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#1E1E28',
    marginBottom: 24, fontWeight: '500'
  },
  
  destHint: { color: '#636366', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 32, textAlign: 'center' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 16,
    shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#1E1E28', shadowOpacity: 0 },
  submitBtnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },

  // Success Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: '#12121A', width: '100%', borderRadius: 32, padding: 32, 
    alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28',
    shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 40, elevation: 20
  },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212, 175, 55, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  modalMessage: { color: '#8E8E93', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 28, fontWeight: '500' },
  refBox: { backgroundColor: '#05050A', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', width: '100%', alignItems: 'center', marginBottom: 32 },
  refLabel: { color: '#636366', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  refText: { color: '#D4AF37', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '900', letterSpacing: 1 },
  modalDoneBtn: { backgroundColor: '#1E1E28', width: '100%', paddingVertical: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A4A' },
  modalDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
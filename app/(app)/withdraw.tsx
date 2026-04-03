import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

export default function WithdrawScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  
  // Payout Routes
  const [payoutRoutes, setPayoutRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // 🚨 Modal Control States
  const [modalVisible, setModalVisible] = useState(false);
  const [successRef, setSuccessRef] = useState('');
  const [kycModalVisible, setKycModalVisible] = useState(false);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorConfig, setErrorConfig] = useState({ title: '', message: '' });

  const triggerError = (title: string, message: string) => {
    setErrorConfig({ title, message });
    setShowErrorModal(true);
  };

  useEffect(() => {
    // Fetch Main Balance
    apiClient.get('/wallet/summary')
      .then(res => setWalletBalance(res.data.balances.main))
      .catch(() => {});
      
    // Fetch saved payout routes
    apiClient.get('/users/payout-accounts')
      .then(res => setPayoutRoutes(res.data))
      .catch(() => setPayoutRoutes([]));
  }, []);

  const handleNext = () => {
    if (step === 1) {
      const val = parseFloat(amount);
      if (!val || val <= 0) return triggerError('INVALID AMOUNT', 'Please input a valid withdrawal amount.');
      if (val > walletBalance) return triggerError('INSUFFICIENT FUNDS', `Your available balance is $${walletBalance.toFixed(2)}.`);
    }
    if (step === 2 && !selectedRoute) return triggerError('NO ROUTE SELECTED', 'Please select a destination account.');
    setStep(s => s + 1);
  };

  const handleWithdraw = async () => {
    // 🚨 THE KYC INTERCEPT: Stop them right before they submit
    if (user?.kyc_status !== 'verified') {
      setKycModalVisible(true);
      return;
    }

    if (!selectedRoute) return;
    setLoading(true);
    try {
      const dest = `[${selectedRoute.type.toUpperCase()}] ${selectedRoute.label} - ${selectedRoute.details}`;
      const res = await apiClient.post('/wallet/withdraw', { amount: parseFloat(amount), destination_details: dest });
      
      setSuccessRef(res.data.reference);
      setModalVisible(true);
    } catch (err: any) {
      triggerError('WITHDRAWAL FAILED', err.response?.data?.detail ?? 'Failed to submit withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Ionicons name="arrow-up-circle" size={28} color="#D4AF37" style={{ marginBottom: 8 }} />
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.progressLine, i <= step ? styles.progressActive : styles.progressInactive]} />
          ))}
        </View>
        <Text style={styles.stepIndicator}>STEP {step} OF 3: {step === 1 ? 'AMOUNT' : step === 2 ? 'ACCOUNT' : 'CONFIRM'}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* STEP 1: AMOUNT */}
          {step === 1 && (
            <View>
              <View style={styles.balancePill}>
                <Ionicons name="wallet" size={16} color="#8E8E93" />
                <Text style={styles.balancePillText}>Available Balance: <Text style={{color: '#FFFFFF', fontWeight: 'bold'}}>${walletBalance.toFixed(2)}</Text></Text>
              </View>

              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>WITHDRAWAL AMOUNT (USD)</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.currencySign}>$</Text>
                  <TextInput style={styles.amountInput} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#636366" value={amount} onChangeText={setAmount} autoFocus />
                </View>
                <View style={styles.quickRow}>
                  {QUICK_AMOUNTS.map(q => (
                    <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setAmount(String(q))}>
                      <Text style={styles.quickChipText}>{q >= 1000 ? `${q / 1000}k` : q}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.quickChip} onPress={() => setAmount(walletBalance.toString())}>
                    <Text style={styles.quickChipText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: DESTINATION */}
          {step === 2 && (
            <View>
              <Text style={styles.instructionLabel}>SELECT WITHDRAWAL METHOD</Text>
              {payoutRoutes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="warning" size={32} color="#D4AF37" style={{ marginBottom: 12 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', marginBottom: 4 }}>No Accounts Saved</Text>
                  <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>You must add a Bank or Crypto wallet in your Settings before withdrawing.</Text>
                  <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(app)/settings' as any)}>
                    <Text style={styles.settingsBtnText}>Go to Settings</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                payoutRoutes.map((route: any) => {
                  const sel = selectedRoute?.id === route.id;
                  return (
                    <TouchableOpacity key={route.id} style={[styles.methodCard, sel && styles.methodCardActive]} onPress={() => setSelectedRoute(route)} activeOpacity={0.8}>
                      <View style={[styles.methodIconBox, sel && styles.methodIconBoxActive]}>
                        <Ionicons name={route.type === 'bank' ? 'business' : 'logo-bitcoin'} size={24} color={sel ? '#D4AF37' : '#8E8E93'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodName, sel && { color: '#D4AF37' }]}>{route.label}</Text>
                        <Text style={styles.methodSub}>{route.details}</Text>
                      </View>
                      <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={24} color={sel ? '#D4AF37' : '#334155'} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && selectedRoute && (
            <View>
              <Text style={styles.instructionLabel}>WITHDRAWAL SUMMARY</Text>
              <View style={styles.reviewCard}>
                
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>AMOUNT TO WITHDRAW</Text>
                  <Text style={styles.reviewValueGold}>${parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
                </View>
                <View style={styles.divider} />
                
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>SEND TO</Text>
                  <Text style={styles.reviewValue}>{selectedRoute.label}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>DETAILS</Text>
                  <Text style={styles.reviewValue}>{selectedRoute.details}</Text>
                </View>

              </View>

              <Text style={styles.destHint}><Ionicons name="lock-closed" size={10} color="#636366" /> SECURE WITHDRAWAL</Text>
            </View>
          )}

          {/* NAVIGATION */}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {step < 3 ? (
              <TouchableOpacity style={[styles.nextBtn, step === 1 && { flex: 1 }, (!amount || (step===2 && !selectedRoute)) && { opacity: 0.5 }]} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={14} color="#05050A" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.nextBtn, loading && { opacity: 0.5 }]} onPress={handleWithdraw} disabled={loading}>
                {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.nextBtnText}>SUBMIT WITHDRAWAL</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🚨 KYC REQUIRED MODAL */}
      <Modal visible={kycModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}><Ionicons name="shield-half" size={40} color="#D4AF37" /></View>
            <Text style={styles.modalTitle}>IDENTITY VERIFICATION</Text>
            <Text style={styles.modalMessage}>
              Regulatory compliance requires identity verification (KYC) before liquidity can be withdrawn from your vault.
            </Text>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { setKycModalVisible(false); router.push('/(app)/kyc' as any); }}>
              <Text style={styles.modalDoneText}>PROCEED TO KYC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setKycModalVisible(false)}>
              <Text style={styles.cancelLinkText}>CANCEL OPERATION</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🚨 ERROR MODAL */}
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorIconCircle}><Ionicons name="warning" size={40} color="#FF3B30" /></View>
            <Text style={styles.modalTitle}>{errorConfig.title}</Text>
            <Text style={styles.modalMessage}>{errorConfig.message}</Text>
            <TouchableOpacity style={styles.errorDoneBtn} onPress={() => setShowErrorModal(false)}>
              <Text style={styles.errorDoneText}>ACKNOWLEDGE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}><Ionicons name="checkmark-circle" size={48} color="#D4AF37" /></View>
            <Text style={styles.modalTitle}>WITHDRAWAL PENDING</Text>
            <Text style={styles.modalMessage}>Your withdrawal request for <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>${parseFloat(amount).toFixed(2)}</Text> is under review.</Text>
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>TRANSACTION ID</Text>
              <Text style={styles.refText}>{successRef}</Text>
            </View>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { setModalVisible(false); router.replace('/(app)/portfolio' as any); }}>
              <Text style={styles.modalDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30, backgroundColor: '#12121A', borderBottomWidth: 1, borderBottomColor: '#1E1E28' },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 },
  progressContainer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressLine: { flex: 1, height: 4, borderRadius: 2 },
  progressActive: { backgroundColor: '#D4AF37' },
  progressInactive: { backgroundColor: '#1E1E28' },
  stepIndicator: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },

  balancePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', marginTop: 10 },
  balancePillText: { color: '#8E8E93', fontSize: 12, marginLeft: 10 },

  amountCard: { backgroundColor: '#12121A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E1E28', marginTop: 20 },
  amountLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1E28', paddingBottom: 16 },
  currencySign: { color: '#D4AF37', fontSize: 36, fontWeight: '900', marginRight: 12 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 44, fontWeight: '900', paddingVertical: 0, fontVariant: ['tabular-nums'] },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' },
  quickChip: { flex: 1, minWidth: '20%', backgroundColor: '#05050A', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E1E28', alignItems: 'center' },
  quickChipText: { color: '#8E8E93', fontWeight: '800', fontSize: 12 },

  instructionLabel: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, marginTop: 10 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E1E28' },
  methodCardActive: { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' },
  methodIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#05050A', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: '#1E1E28' },
  methodIconBoxActive: { borderColor: '#D4AF37' },
  methodName: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  methodSub: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  reviewCard: { backgroundColor: '#12121A', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 20 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  reviewLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  reviewValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  reviewValueGold: { color: '#D4AF37', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: '#1E1E28', marginVertical: 12 },
  destHint: { color: '#636366', fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginTop: 10 },

  emptyState: { backgroundColor: '#12121A', padding: 32, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28', borderStyle: 'dashed' },
  settingsBtn: { backgroundColor: '#1E1E28', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  settingsBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  navRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  prevBtn: { flex: 1, backgroundColor: '#1E1E28', paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  prevBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  nextBtn: { flex: 2, flexDirection: 'row', gap: 8, backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // Unified Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#12121A', width: '100%', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  errorIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 59, 48, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)' },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  modalMessage: { color: '#8E8E93', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  refBox: { backgroundColor: '#05050A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', width: '100%', alignItems: 'center', marginBottom: 32 },
  refLabel: { color: '#636366', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  refText: { color: '#D4AF37', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  
  modalDoneBtn: { backgroundColor: '#D4AF37', width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalDoneText: { color: '#05050A', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  
  errorDoneBtn: { backgroundColor: '#1E1E28', borderWidth: 1, borderColor: '#FF3B30', width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  errorDoneText: { color: '#FF3B30', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  
  cancelLinkBtn: { marginTop: 16, padding: 8 },
  cancelLinkText: { color: '#636366', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});
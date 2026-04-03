/**
 * deposit.tsx
 * Simple, Step-by-Step Deposit Flow
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, Image, SafeAreaView, Platform, Modal
} from 'react-native';
import { useRouter, Tabs } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import type { PaymentMethod } from '../../types/trading';

const METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  crypto: 'hardware-chip', bank_transfer: 'business', p2p_app: 'phone-portrait',
};
const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

export default function DepositScreen() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [proofImage, setProofImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState(1800); 
  const [modalVisible, setModalVisible] = useState(false);
  const [successRef, setSuccessRef] = useState('');

  useEffect(() => {
    apiClient.get<PaymentMethod[]>('/wallet/payment-methods')
      .then(res => setMethods(res.data))
      .catch(() => {})
      .finally(() => setMethodsLoading(false));
  }, []);

  useEffect(() => {
    if (step !== 3 || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [step, timeLeft]);

  const formatTime = () => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setProofImage(result.assets[0]);
  };

  const handleNext = () => {
    if (step === 1 && (!amount || parseFloat(amount) <= 0)) return;
    if (step === 2 && !selectedMethod) return;
    setStep(s => s + 1);
  };

 const handleDeposit = async () => {
    if (!selectedMethod || !proofImage) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('payment_method_id', selectedMethod.id);
      
      // 🚨 CRITICAL FIX: Web vs Mobile File Upload handling
      if (Platform.OS === 'web') {
        const response = await fetch(proofImage.uri);
        const blob = await response.blob();
        formData.append('proof_image', blob, `proof_${Date.now()}.jpg`);
      } else {
        const ext = proofImage.uri.split('.').pop() ?? 'jpg';
        formData.append('proof_image', { uri: proofImage.uri, name: `proof.${ext}`, type: `image/${ext}` } as any);
      }

      const res = await apiClient.post('/wallet/deposit', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': `dep-${Date.now()}` },
      });

      setSuccessRef(res.data.reference);
      setModalVisible(true);
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Failed to submit deposit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Tabs.Screen options={{ headerShown: false }} />

      {/* 🚨 NEW: The webCenter wrapper fixes the horizontal cutoff and makes desktop look amazing */}
      <View style={styles.webCenter}>
        <View style={styles.header}>
          <Ionicons name="arrow-down-circle" size={28} color="#D4AF37" style={{ marginBottom: 8 }} />
          <Text style={styles.headerTitle}>Deposit Funds</Text>
          
          <View style={styles.progressContainer}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.progressLine, i <= step ? styles.progressActive : styles.progressInactive]} />
            ))}
          </View>
          <Text style={styles.stepIndicator}>STEP {step} OF 3: {step === 1 ? 'AMOUNT' : step === 2 ? 'METHOD' : 'PAYMENT'}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {/* STEP 1: AMOUNT */}
          {step === 1 && (
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>DEPOSIT AMOUNT (USD)</Text>
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
              </View>
            </View>
          )}

          {/* STEP 2: GATEWAY SELECTION */}
          {step === 2 && (
            <View>
              <Text style={styles.instructionLabel}>SELECT PAYMENT METHOD</Text>
              {methodsLoading ? <ActivityIndicator color="#D4AF37" /> : methods.map(m => {
                const sel = selectedMethod?.id === m.id;
                return (
                  <TouchableOpacity key={m.id} style={[styles.methodCard, sel && styles.methodCardActive]} onPress={() => setSelectedMethod(m)} activeOpacity={0.8}>
                    <View style={[styles.methodIconBox, sel && styles.methodIconBoxActive]}>
                      <Ionicons name={METHOD_ICONS[m.method_type] ?? 'card'} size={24} color={sel ? '#D4AF37' : '#8E8E93'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.methodName, sel && { color: '#D4AF37' }]}>{m.name}</Text>
                      <Text style={styles.methodSub}>{m.method_type.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                    <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={24} color={sel ? '#D4AF37' : '#334155'} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STEP 3: INSTRUCTIONS & TIMER */}
          {step === 3 && selectedMethod && (
            <View>
              <View style={styles.timerCard}>
                <Ionicons name="time-outline" size={24} color="#EF4444" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.timerLabel}>WAITING FOR PAYMENT</Text>
                  <Text style={styles.timerSub}>Please send your payment before the timer runs out.</Text>
                </View>
                <Text style={styles.timerText}>{formatTime()}</Text>
              </View>

              <View style={styles.instructionBox}>
                <View style={styles.amountDisplayBox}>
                  <Text style={styles.amountDisplayLabel}>AMOUNT TO SEND</Text>
                  <Text style={styles.amountDisplayValue}>${parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
                </View>

                <Text style={styles.instructionLabel}>SEND PAYMENT TO</Text>
                <View style={styles.accountDetailsBox}>
                  <Text style={styles.accountDetails} selectable={true}>{selectedMethod.account_details}</Text>
                </View>
                {selectedMethod.instructions && <Text style={styles.instructionText}>{selectedMethod.instructions}</Text>}
              </View>

              <Text style={styles.instructionLabel}>UPLOAD PAYMENT RECEIPT</Text>
              <TouchableOpacity style={[styles.uploadBtn, proofImage && styles.uploadBtnDone]} onPress={pickImage}>
                <Ionicons name={proofImage ? 'shield-checkmark' : 'cloud-upload-outline'} size={24} color={proofImage ? '#D4AF37' : '#636366'} />
                <View style={{ marginLeft: 16 }}>
                  <Text style={[styles.uploadTitle, proofImage && { color: '#D4AF37' }]}>{proofImage ? 'RECEIPT UPLOADED' : 'ATTACH RECEIPT'}</Text>
                  <Text style={styles.uploadSub}>{proofImage ? 'Tap to change image' : 'Screenshot or photo of transfer'}</Text>
                </View>
              </TouchableOpacity>
              
              {proofImage && <Image source={{ uri: proofImage.uri }} style={styles.previewImage} />}
            </View>
          )}

          {/* NAVIGATION BUTTONS */}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {step < 3 ? (
              <TouchableOpacity style={[styles.nextBtn, step === 1 && { flex: 1 }, (!amount || (step===2 && !selectedMethod)) && { opacity: 0.5 }]} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={14} color="#05050A" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.nextBtn, (!proofImage || loading) && { opacity: 0.5 }]} onPress={handleDeposit} disabled={!proofImage || loading}>
                {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.nextBtnText}>SUBMIT DEPOSIT</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}><Ionicons name="checkmark-circle" size={48} color="#D4AF37" /></View>
            <Text style={styles.modalTitle}>DEPOSIT PENDING</Text>
            <Text style={styles.modalMessage}>Your deposit is currently under review. Your balance will be updated once it is approved.</Text>
            <View style={styles.refBox}>
              <Text style={styles.refLabel}>TRANSACTION ID</Text>
              <Text style={styles.refText}>{successRef}</Text>
            </View>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { setModalVisible(false); router.replace('/(app)/portfolio' as any); }}>
              <Text style={styles.modalDoneText}>BACK TO WALLET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🚨 Reverted forced width. pure flex naturally fits the screen bounds.
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  
  // 🚨 This caps the width on large desktop monitors, preventing stretching, while centering the flow perfectly.
  webCenter: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  scroll: { padding: 20, paddingBottom: 60 },
  
  header: { padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30, backgroundColor: '#12121A', borderBottomWidth: 1, borderBottomColor: '#1E1E28' },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 },
  progressContainer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressLine: { flex: 1, height: 4, borderRadius: 2 },
  progressActive: { backgroundColor: '#D4AF37' },
  progressInactive: { backgroundColor: '#1E1E28' },
  stepIndicator: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },

  amountCard: { backgroundColor: '#12121A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E1E28', marginTop: 20 },
  amountLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1E28', paddingBottom: 16 },
  currencySign: { color: '#D4AF37', fontSize: 36, fontWeight: '900', marginRight: 12 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 44, fontWeight: '900', paddingVertical: 0, fontVariant: ['tabular-nums'] },
  
  // 🚨 Enforced flexWrap so buttons wrap to the next line on tiny screens
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' },
  quickChip: { minWidth: '22%', flexGrow: 1, backgroundColor: '#05050A', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E1E28', alignItems: 'center' },
  quickChipText: { color: '#8E8E93', fontWeight: '800', fontSize: 12 },

  instructionLabel: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, marginTop: 10 },
  
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E1E28' },
  methodCardActive: { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' },
  methodIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#05050A', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: '#1E1E28' },
  methodIconBoxActive: { borderColor: '#D4AF37' },
  methodName: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  methodSub: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  timerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 24, marginTop: 10 },
  timerLabel: { color: '#EF4444', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  timerSub: { color: '#EF4444', fontSize: 11, opacity: 0.8, marginTop: 2 },
  timerText: { color: '#EF4444', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },

  instructionBox: { backgroundColor: '#12121A', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#1E1E28' },
  amountDisplayBox: { backgroundColor: '#05050A', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#1E1E28' },
  amountDisplayLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  amountDisplayValue: { color: '#D4AF37', fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  accountDetailsBox: { backgroundColor: '#05050A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 16 },
  accountDetails: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  instructionText: { color: '#8E8E93', fontSize: 12, lineHeight: 18, fontWeight: '500' },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E1E28', borderStyle: 'dashed', marginBottom: 16 },
  uploadBtnDone: { borderStyle: 'solid', borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' },
  uploadTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  uploadSub: { color: '#636366', fontSize: 11, marginTop: 4 },
  previewImage: { width: '100%', height: 120, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 20 },

  navRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  prevBtn: { flex: 1, backgroundColor: '#1E1E28', paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  prevBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  nextBtn: { flex: 2, flexDirection: 'row', gap: 8, backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#12121A', width: '100%', maxWidth: 400, borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  modalMessage: { color: '#8E8E93', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  refBox: { backgroundColor: '#05050A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', width: '100%', alignItems: 'center', marginBottom: 32 },
  refLabel: { color: '#636366', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  refText: { color: '#D4AF37', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  modalDoneBtn: { backgroundColor: '#1E1E28', width: '100%', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  modalDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
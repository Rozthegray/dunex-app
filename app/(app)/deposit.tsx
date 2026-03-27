/**
 * deposit.tsx
 * Institutional Capital Injection (Deposit)
 * Features secure routing selection, receipt vaulting, and cryptographic design.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, Image, Animated, SafeAreaView, Platform, Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import type { PaymentMethod } from '../../types/trading';

const METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  crypto: 'hardware-chip',
  bank_transfer: 'business',
  p2p_app: 'phone-portrait',
};

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000, 100000];

export default function DepositScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [proofImage, setProofImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(true);

  // --- Premium Notification State ---
  const [notification, setNotification] = useState<{ visible: boolean, type: 'success' | 'error', message: string }>({ visible: false, type: 'success', message: '' });
  const slideAnim = useRef(new Animated.Value(-150)).current;

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ visible: true, type, message });
    Animated.spring(slideAnim, { toValue: Platform.OS === 'ios' ? 50 : 20, useNativeDriver: true, speed: 12 }).start();
    
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -150, duration: 400, useNativeDriver: true }).start(() => {
        setNotification({ visible: false, type: 'success', message: '' });
        if (type === 'success') router.replace('/(app)/deposit-history' as any);
      });
    }, 3500);
  };

  useEffect(() => {
    apiClient.get<PaymentMethod[]>('/wallet/payment-methods')
      .then(res => {
        setMethods(res.data);
        if (res.data.length > 0) setSelectedMethod(res.data[0]);
      })
      .catch(() => showNotification('error', 'Failed to establish connection with routing gateways.'))
      .finally(() => setMethodsLoading(false));
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return showNotification('error', 'Media vault access is required for receipt upload.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled) setProofImage(result.assets[0]);
  };

  const handleDeposit = async () => {
    Keyboard.dismiss(); 
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return showNotification('error', 'Enter a valid settlement amount.');
    if (!selectedMethod) return showNotification('error', 'A routing gateway must be selected.');
    if (!proofImage) return showNotification('error', 'A transfer receipt is required to authorize this ledger entry.');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', val.toString());
      formData.append('payment_method_id', selectedMethod.id);

      // Web vs Native File Upload Fix
      if (Platform.OS === 'web') {
        const response = await fetch(proofImage.uri);
        const blob = await response.blob();
        formData.append('proof_image', blob, `proof_${Date.now()}.jpg`);
      } else {
        const ext = proofImage.uri.split('.').pop() ?? 'jpg';
        formData.append('proof_image', {
          uri: proofImage.uri,
          name: `proof_${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as any);
      }

      const uniqueKey = `dep-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      await apiClient.post('/wallet/deposit', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': uniqueKey 
        },
      });

      showNotification('success', 'TRANSFER INITIATED. Awaiting clearance protocol.');
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail ?? 'Transmission failed. Verify network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* PREMIUM NOTIFICATION BANNER */}
      {notification.visible && (
        <Animated.View style={[
          styles.notificationBanner, 
          { transform: [{ translateY: slideAnim }], borderColor: notification.type === 'success' ? '#D4AF37' : '#FF3B30' }
        ]}>
          <View style={[styles.notificationIconBox, { backgroundColor: notification.type === 'success' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 59, 48, 0.1)' }]}>
            <Ionicons name={notification.type === 'success' ? 'shield-checkmark' : 'warning'} size={20} color={notification.type === 'success' ? '#D4AF37' : '#FF3B30'} />
          </View>
          <Text style={styles.notificationText}>{notification.message}</Text>
        </Animated.View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerGreeting}>ONE CLICK</Text>
          <Text style={styles.headerTitle}>MAKE DEPOSIT</Text>
          <Text style={styles.subtitle}>Assets will reflect in your ledger upon clearance.</Text>
        </View>

        {/* AMOUNT CARD */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}> AMOUNT (USD)</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySign}>$</Text>
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
          </View>
        </View>

        {/* ROUTING GATEWAY (Payment Methods) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ROUTING GATEWAY</Text>
        </View>
        
        {methodsLoading ? (
          <ActivityIndicator color="#D4AF37" style={{ marginBottom: 30 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }} contentContainerStyle={{ paddingRight: 20 }}>
            {methods.map(m => {
              const sel = selectedMethod?.id === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodCard, sel && styles.methodCardActive]}
                  onPress={() => setSelectedMethod(m)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.methodIconBox, sel && styles.methodIconBoxActive]}>
                    <Ionicons name={METHOD_ICONS[m.method_type] ?? 'card'} size={22} color={sel ? '#D4AF37' : '#8E8E93'} />
                  </View>
                  <Text style={[styles.methodName, sel && styles.methodNameActive]} numberOfLines={1}>{m.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* WIRE INSTRUCTIONS */}
        {selectedMethod && (
          <View style={styles.instructionBox}>
            <Text style={styles.instructionLabel}>DESTINATION LEDGER</Text>
            <View style={styles.accountDetailsBox}>
              <Text style={styles.accountDetails} selectable={true}>{selectedMethod.account_details}</Text>
            </View>
            {selectedMethod.instructions && (
              <Text style={styles.instructionText}>{selectedMethod.instructions}</Text>
            )}
          </View>
        )}

        {/* RECEIPT VAULT */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRANSFER RECEIPT</Text>
        </View>
        <TouchableOpacity style={[styles.uploadBtn, proofImage && styles.uploadBtnDone]} onPress={pickImage} activeOpacity={0.8}>
          <View style={[styles.uploadIconBox, proofImage && { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
            <Ionicons name={proofImage ? 'shield-checkmark' : 'document-lock'} size={24} color={proofImage ? '#D4AF37' : '#636366'} />
          </View>
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={[styles.uploadTitle, proofImage && { color: '#D4AF37' }]}>
              {proofImage ? 'DOCUMENT SECURED' : 'ATTACH RECEIPT'}
            </Text>
            <Text style={styles.uploadSub}>{proofImage ? 'Tap to modify selection' : 'JPEG / PNG Required'}</Text>
          </View>
        </TouchableOpacity>

        {proofImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: proofImage.uri }} style={styles.previewImage} />
            <View style={styles.previewOverlay} />
          </View>
        )}

        {/* SUBMIT */}
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleDeposit} disabled={loading} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#05050A" /> : (
            <>
              <Text style={styles.submitBtnText}>AUTHORIZE DEPOSIT</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' }, // Pitch black
  scroll: { padding: 20 },
  
  // High-Grade Notification Banner
  notificationBanner: { position: 'absolute', top: 0, left: 20, right: 20, zIndex: 100, flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', padding: 16, borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  notificationIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  notificationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginLeft: 16, flex: 1, letterSpacing: 0.5 },

  header: { marginTop: Platform.OS === 'ios' ? 10 : 20, marginBottom: 30 },
  headerGreeting: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#8E8E93', fontSize: 13, marginTop: 8, fontWeight: '500' },

  amountCard: { backgroundColor: '#12121A', borderRadius: 24, padding: 24, marginBottom: 30, borderWidth: 1, borderColor: '#1E1E28' },
  amountLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1E28', paddingBottom: 16 },
  currencySign: { color: '#D4AF37', fontSize: 36, fontWeight: '900', marginRight: 12 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 44, fontWeight: '900', paddingVertical: 0, fontVariant: ['tabular-nums'] },
  
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  quickChip: { flex: 1, backgroundColor: '#05050A', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E1E28', alignItems: 'center' },
  quickChipText: { color: '#8E8E93', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  sectionHeader: { marginBottom: 12 },
  sectionTitle: { color: '#636366', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  methodCard: { backgroundColor: '#05050A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E1E28', marginRight: 12, width: 140 },
  methodCardActive: { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.05)' },
  methodIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#12121A', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1E1E28' },
  methodIconBoxActive: { borderColor: '#D4AF37', backgroundColor: '#05050A' },
  methodName: { color: '#8E8E93', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  methodNameActive: { color: '#D4AF37' },

  instructionBox: { backgroundColor: '#12121A', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#1E1E28' },
  instructionLabel: { color: '#636366', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  accountDetailsBox: { backgroundColor: '#05050A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', marginBottom: 16 },
  accountDetails: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  instructionText: { color: '#8E8E93', fontSize: 13, lineHeight: 20, fontWeight: '500' },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#05050A', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1E1E28', borderStyle: 'dashed' },
  uploadBtnDone: { borderStyle: 'solid', borderColor: '#D4AF37', backgroundColor: '#12121A' },
  uploadIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#12121A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28' },
  uploadTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  uploadSub: { color: '#636366', fontSize: 11, marginTop: 4, fontWeight: '600' },
  
  previewContainer: { position: 'relative', marginBottom: 30, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1E1E28' },
  previewImage: { width: '100%', height: 180, resizeMode: 'cover' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 5, 10, 0.2)' }, // Subtle dark tint

  submitBtn: { backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  submitBtnDisabled: { backgroundColor: '#1E1E28', shadowOpacity: 0 },
  submitBtnText: { color: '#05050A', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
});
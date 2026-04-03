import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, 
  Image, Modal 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [referralCode, setReferralCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🚨 Modal Control States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorConfig, setErrorConfig] = useState({ title: '', message: '' });

  // Helper to trigger the error modal
  const triggerError = (title: string, message: string) => {
    setErrorConfig({ title, message });
    setShowErrorModal(true);
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      triggerError('INCOMPLETE DOSSIER', 'All identity fields must be populated to proceed.');
      return;
    }
    if (password.length < 8) {
      triggerError('SECURITY REQUIREMENT', 'Your secure passphrase must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Establish the account
      await apiClient.post('/auth/register', {
        email,
        password,
        full_name: fullName,
        referral_code: referralCode,
      });
      
      // 2. Automatically log them in in the background
      await login(email, password);
      
      // 3. Trigger the Success Modal
      setShowSuccessModal(true);
      
    } catch (error: any) {
      // Catch backend errors (e.g., "Email already registered")
      const backendMessage = error.response?.data?.detail || 'System rejected the creation request. Please try again.';
      triggerError('REGISTRATION FAILED', backendMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToKYC = () => {
    setShowSuccessModal(false);
    // Push them into the KYC screen after acknowledging the modal
    router.replace('/(app)/kyc' as any); 
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* INSTITUTIONAL BRANDING */}
          <View style={styles.brandBox}>
            <Image 
              source={require('../../assets/images/icon.png')} 
              style={styles.customLogo} 
              resizeMode="contain"
            />
            <Text style={styles.title}>DUNEX MARKETS</Text>
            <Text style={styles.subtitle}>CLIENT ONBOARDING</Text>
          </View>

          {/* INPUTS */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>LEGAL NAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter full name (e.g. Patrick Bateman)"
                placeholderTextColor="#636366"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="client@dunexops.com"
                placeholderTextColor="#636366"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SECURE PASSPHRASE</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#636366"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>REFERRAL CODE (OPTIONAL)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="people" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. DNX-A1B2C3"
                placeholderTextColor="#636366"
                autoCapitalize="characters"
                value={referralCode}
                onChangeText={setReferralCode}
              />
            </View>
          </View>

          {/* ACTIONS */}
          <TouchableOpacity style={[styles.loginButton, isSubmitting && { opacity: 0.7 }]} onPress={handleRegister} disabled={isSubmitting} activeOpacity={0.8}>
            {isSubmitting ? (
              <ActivityIndicator color="#05050A" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>ESTABLISH ACCOUNT</Text>
                <Ionicons name="shield-checkmark" size={16} color="#05050A" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>ALREADY REGISTERED? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)} activeOpacity={0.7}>
              <Text style={styles.registerText}>RETURN TO LOGIN</Text>
            </TouchableOpacity>
          </View>
          
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🚨 SUCCESS MODAL */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="mail-unread" size={40} color="#D4AF37" />
            </View>
            <Text style={styles.modalTitle}>ACCOUNT CREATED</Text>
            <Text style={styles.modalText}>
              Your institutional dossier has been successfully generated. We have dispatched an onboarding transmission to your email.
            </Text>
            <Text style={styles.modalSubText}>
              To activate your vault, you must complete the identity verification process.
            </Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={handleProceedToKYC} activeOpacity={0.8}>
              <Text style={styles.modalButtonText}>PROCEED TO KYC</Text>
              <Ionicons name="arrow-forward" size={16} color="#05050A" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🚨 ERROR MODAL */}
      <Modal visible={showErrorModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="warning" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>{errorConfig.title}</Text>
            <Text style={styles.modalText}>
              {errorConfig.message}
            </Text>
            
            <TouchableOpacity style={styles.errorButton} onPress={() => setShowErrorModal(false)} activeOpacity={0.8}>
              <Text style={styles.errorButtonText}>ACKNOWLEDGE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  
  brandBox: { alignItems: 'center', marginBottom: 50 },
  customLogo: { width: 80, height: 80, marginBottom: 16 }, 
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: 3, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#D4AF37', textAlign: 'center', fontWeight: '900', letterSpacing: 3 },
  
  inputGroup: { marginBottom: 24 },
  label: { color: '#8E8E93', fontSize: 10, marginBottom: 8, fontWeight: '900', letterSpacing: 1.5, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', borderWidth: 1, borderColor: '#1E1E28', borderRadius: 12, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600', paddingVertical: 18 },
  
  loginButton: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 18, alignItems: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5, marginTop: 16 },
  loginButtonText: { color: '#05050A', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { color: '#636366', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  registerText: { color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // 🚨 MODAL STYLES (Success & Error)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E28',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  modalSubText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
  },
  modalButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
  },
  modalButtonText: {
    color: '#05050A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  errorButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    marginTop: 10,
  },
  errorButtonText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
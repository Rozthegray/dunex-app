import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';

export default function ResetPasswordScreen() {
  const router = useRouter();
  // Catch the email passed from the previous screen
  const { email } = useLocalSearchParams<{ email: string }>(); 
  
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorConfig, setErrorConfig] = useState({ title: '', message: '' });

  const triggerError = (title: string, message: string) => {
    setErrorConfig({ title, message });
    setShowErrorModal(true);
  };

  const handleApplyReset = async () => {
    if (code.length !== 6) {
      return triggerError('INVALID CODE', 'The security code must be exactly 6 digits.');
    }
    if (newPassword.length < 8) {
      return triggerError('WEAK PASSPHRASE', 'Your new passphrase must be at least 8 characters long.');
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: email,
        code: code,
        new_password: newPassword
      });
      setShowSuccessModal(true);
    } catch (error: any) {
      triggerError('AUTHENTICATION FAILED', error.response?.data?.detail || 'The code provided is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const completeRecovery = () => {
    setShowSuccessModal(false);
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.formContainer}>
          
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color="#D4AF37" />
          </View>
          
          <Text style={styles.title}>VERIFY PROTOCOL</Text>
          <Text style={styles.subtitle}>Enter the 6-digit authorization code dispatched to your ledger.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>AUTHORIZATION CODE</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="keypad" size={16} color="#D4AF37" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { letterSpacing: 8, fontSize: 20, textAlign: 'center' }]} 
                placeholder="000000" 
                placeholderTextColor="#636366" 
                keyboardType="number-pad" 
                maxLength={6}
                value={code} 
                onChangeText={setCode} 
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NEW PASSPHRASE</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Minimum 8 characters" 
                placeholderTextColor="#636366" 
                secureTextEntry
                value={newPassword} 
                onChangeText={setNewPassword} 
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleApplyReset} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.buttonText}>APPLY NEW PASSPHRASE</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.cancelText}>CANCEL OPERATION</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {/* SUCCESS MODAL */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.errorIconContainer, { backgroundColor: 'rgba(212, 175, 55, 0.1)', borderColor: 'rgba(212, 175, 55, 0.2)' }]}>
              <Ionicons name="checkmark-done" size={40} color="#D4AF37" />
            </View>
            <Text style={styles.modalTitle}>VAULT SECURED</Text>
            <Text style={styles.modalText}>Your new secure passphrase has been successfully written to the ledger.</Text>
            <TouchableOpacity style={[styles.errorButton, { borderColor: '#D4AF37' }]} onPress={completeRecovery} activeOpacity={0.8}>
              <Text style={[styles.errorButtonText, { color: '#D4AF37' }]}>RETURN TO LOGIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ERROR MODAL */}
      <Modal visible={showErrorModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="warning" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>{errorConfig.title}</Text>
            <Text style={styles.modalText}>{errorConfig.message}</Text>
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
  container: { flex: 1, justifyContent: 'center' },
  formContainer: { paddingHorizontal: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(212, 175, 55, 0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)', marginBottom: 30, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: 1, marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginBottom: 40, lineHeight: 18, fontWeight: '500', paddingHorizontal: 20 },
  inputGroup: { marginBottom: 30 },
  label: { color: '#8E8E93', fontSize: 10, marginBottom: 8, fontWeight: '900', letterSpacing: 1.5, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121A', borderWidth: 1, borderColor: '#1E1E28', borderRadius: 12, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600', paddingVertical: 18 },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 18, alignItems: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  buttonText: { color: '#05050A', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  cancelBtn: { marginTop: 24, alignItems: 'center' },
  cancelText: { color: '#636366', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#12121A', borderWidth: 1, borderColor: '#1E1E28', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%' },
  errorIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 59, 48, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)' },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginBottom: 12, textAlign: 'center' },
  modalText: { color: '#8E8E93', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  errorButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E1E28', borderWidth: 1, borderColor: '#FF3B30', borderRadius: 12, paddingVertical: 16, width: '100%', marginTop: 10 },
  errorButtonText: { color: '#FF3B30', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
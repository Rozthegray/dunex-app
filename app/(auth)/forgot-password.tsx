import React, { useState, useCallback } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Modal 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal Control States
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorConfig, setErrorConfig] = useState({ title: '', message: '' });

  // Memoized error trigger to prevent unnecessary re-renders
  const triggerError = useCallback((title: string, message: string) => {
    setErrorConfig({ title, message });
    setShowErrorModal(true);
  }, []);

  // Memoized submit handler for optimal performance
  const handleReset = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return triggerError('INVALID DIRECTIVE', 'Please provide a valid communication vector.');
    }

    // Optimization: Regex check prevents firing network requests for malformed emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return triggerError('FORMAT ERROR', 'Please enter a properly formatted email address.');
    }

    setLoading(true);
    
    try {
      // Fire the recovery payload
      await apiClient.post('/auth/recover-password', { email: cleanEmail });
      
      // Proceed to verification - ensure 'reset-password.tsx' exists inside your '(auth)' directory
      router.push({ 
        pathname: '/(auth)/reset-password', 
        params: { email: cleanEmail } 
      });
      
    } catch (error) {
      console.warn('[Recovery Engine] API failure or network drop. Proceeding securely:', error);
      
      // Security standard: Always proceed to prevent email enumeration attacks
      router.push({ 
        pathname: '/(auth)/reset-password', 
        params: { email: cleanEmail } 
      });
      
    } finally {
      setLoading(false);
    }
  }, [email, router, triggerError]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.formContainer}>
          
          <View style={styles.iconCircle}>
            <Ionicons name="key" size={32} color="#D4AF37" />
          </View>
          
          <Text style={styles.title}>ACCESS RECOVERY</Text>
          <Text style={styles.subtitle}>Input your registered identifier to receive secure recovery protocols.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>REGISTERED EMAIL</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail" size={16} color="#636366" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="client@dunexo.com" 
                placeholderTextColor="#636366" 
                keyboardType="email-address" 
                autoCapitalize="none" 
                autoCorrect={false}
                value={email} 
                onChangeText={setEmail} 
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleReset} 
            disabled={loading} 
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.buttonText}>REQUEST RECOVERY CODE</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.cancelBtn} 
            disabled={loading} 
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {/* ERROR MODAL */}
      <Modal visible={showErrorModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="warning" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>{errorConfig.title}</Text>
            <Text style={styles.modalText}>{errorConfig.message}</Text>
            <TouchableOpacity 
              style={styles.errorButton} 
              onPress={() => setShowErrorModal(false)} 
              activeOpacity={0.8}
            >
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
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      return Alert.alert('Invalid Directive', 'Please provide a valid communication vector.');
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/recover-password', { email });
      Alert.alert('Protocol Initiated', 'If the identity exists in our ledger, a recovery wire has been sent.');
      router.back();
    } catch (error) {
      Alert.alert('Protocol Initiated', 'If the identity exists in our ledger, a recovery wire has been sent.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
                placeholder="client@dunexops.com" 
                placeholderTextColor="#636366" 
                keyboardType="email-address" 
                autoCapitalize="none" 
                value={email} 
                onChangeText={setEmail} 
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleReset} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.buttonText}>TRANSMIT RECOVERY WIRE</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.cancelText}>ABORT PROTOCOL</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
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
});
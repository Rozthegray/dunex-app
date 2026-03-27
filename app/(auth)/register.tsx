import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Incomplete Dossier', 'All identity fields must be populated.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Security Requirement', 'Passphrase must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Establish the account
      await apiClient.post('/auth/register', {
        email,
        password,
        full_name: fullName,
      });

      // 2. Automatically log them in
      await login(email, password);
      
      // 3. Reroute to command center
      router.replace('/'); 
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.detail || 'System rejected the creation request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* INSTITUTIONAL BRANDING */}
          <View style={styles.brandBox}>
            {/* 🚨 UPDATED: Custom App Icon Injection */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  
  brandBox: { alignItems: 'center', marginBottom: 50 },
  // 🚨 NEW: Logo styling replacing the old circle
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
});
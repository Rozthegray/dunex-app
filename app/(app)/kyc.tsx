/**
 * app/(app)/kyc.tsx
 * Institutional KYC Onboarding - 4 Step Paginated Flow
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, SafeAreaView, Platform, Image, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Nigeria", "South Africa", "India", 
  "Germany", "France", "Italy", "Spain", "Brazil", "Mexico", "Japan", "South Korea", "Netherlands", 
  "Switzerland", "Sweden", "Singapore", "New Zealand", "United Arab Emirates", "Saudi Arabia", 
  "Kenya", "Ghana", "Egypt", "Argentina", "Colombia", "Chile", "Malaysia", "Philippines", 
  "Indonesia", "Vietnam", "Thailand", "Turkey", "Israel", "Ireland", "Poland", "Belgium", 
  "Austria", "Norway", "Denmark", "Finland", "Greece", "Portugal", "Czech Republic", "Romania", 
  "Hungary", "Ukraine", "Morocco", "Pakistan", "Bangladesh", "Other"
].sort();

export default function KYCScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  // Pagination State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    gender: '',
    dob: '',
    email: user?.email || '',
    phone: '',
    address: '',
    country: '',
    idNumber: '', 
  });

  // 🚨 UPDATED: Specific Front and Back document states
  const [idFront, setIdFront] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [idBack, setIdBack] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Modals for dropdowns
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const getIdLabel = () => {
    switch(form.country) {
      case 'United States': return 'Social Security Number (SSN)';
      case 'Nigeria': return 'Bank Verification Number (BVN) or NIN';
      case 'United Kingdom': return 'National Insurance Number (NINO)';
      case 'Canada': return 'Social Insurance Number (SIN)';
      case 'India': return 'Aadhaar or PAN Number';
      case 'Australia': return 'Tax File Number (TFN)';
      case 'South Africa': return 'South African ID Number';
      default: return 'National ID or Passport Number';
    }
  };

  const pickImage = async (setFile: React.Dispatch<React.SetStateAction<ImagePicker.ImagePickerAsset | null>>) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setFile(result.assets[0]);
  };

  const nextStep = () => {
    if (step === 1 && (!form.fullName || !form.gender || !form.dob)) return Alert.alert("Required", "Complete all personal details.");
    if (step === 2 && (!form.phone || !form.address || !form.country)) return Alert.alert("Required", "Complete all contact details.");
    if (step === 3 && (!form.idNumber)) return Alert.alert("Required", `Please provide your ${getIdLabel()}.`);
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!idFront || !idBack) return Alert.alert("Required", "Both the front and back of your identity document must be uploaded.");

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Append all the text fields
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      
      // 🚨 CRITICAL FIX: Web vs Mobile File Upload handling
      if (Platform.OS === 'web') {
        // Convert Front Image for Web
        const frontRes = await fetch(idFront.uri);
        const frontBlob = await frontRes.blob();
        formData.append('id_card', frontBlob, 'id_front.jpg');

        // Convert Back Image for Web
        const backRes = await fetch(idBack.uri);
        const backBlob = await backRes.blob();
        formData.append('govt_id', backBlob, 'id_back.jpg');
      } else {
        // Mobile Handling
        formData.append('id_card', { uri: Platform.OS === 'ios' ? idFront.uri.replace('file://', '') : idFront.uri, name: 'id_front.jpg', type: 'image/jpeg' } as any);
        formData.append('govt_id', { uri: Platform.OS === 'ios' ? idBack.uri.replace('file://', '') : idBack.uri, name: 'id_back.jpg', type: 'image/jpeg' } as any);
      }

      // 🚨 REMOVED: hardcoded 'Content-Type' header so the browser auto-generates the boundary tags!
     // 🚨 FIX: Force Axios to use multipart/form-data instead of its default JSON
      await apiClient.post('/users/kyc', formData, { 
        headers: { 
          'Content-Type': 'multipart/form-data' 
        } 
      });

      if (user) setUser({ ...user, kyc_status: 'pending' });
      Alert.alert("Documents Submitted", "Your identity matrix is under review. This usually takes 1-2 business days.");
      router.back();
    } catch (error: any) {
      // Added detailed logging so you can see exactly what FastAPI rejects if it fails again
      console.error("KYC Error Details:", error.response?.data);
      Alert.alert("Submission Failed", error.response?.data?.detail || "Could not upload documents.");
    } finally {
      setLoading(false);
    }
  };


  if (user?.kyc_status === 'pending') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Ionicons name="time-outline" size={64} color="#D4AF37" />
          <Text style={styles.statusTitle}>Verification Pending</Text>
          <Text style={styles.statusSub}>Your documents are currently under review by our compliance team.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>Return to Dashboard</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={28} color="#D4AF37" style={{ marginBottom: 8 }} />
        <Text style={styles.title}>Identity Verification</Text>
        
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.progressLine, i <= step ? styles.progressActive : styles.progressInactive]} />
          ))}
        </View>
        <Text style={styles.stepIndicator}>STEP {step} OF 4</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        
        <View style={styles.formCard}>
          {/* STEP 1: PERSONAL INFO */}
          {step === 1 && (
            <View>
              <Text style={styles.sectionLabel}>Personal Profile</Text>
              
              <Text style={styles.inputLabel}>Full Legal Name</Text>
              <TextInput style={styles.input} placeholderTextColor="#475569" placeholder="As it appears on your ID" value={form.fullName} onChangeText={(v) => updateForm('fullName', v)} />

              <Text style={styles.inputLabel}>Gender</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowGenderModal(true)}>
                <Text style={form.gender ? styles.inputText : styles.placeholderText}>{form.gender || "Select Gender"}</Text>
                <Ionicons name="chevron-down" size={16} color="#8E8E93" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholderTextColor="#475569" placeholder="e.g. 1990-05-24" value={form.dob} onChangeText={(v) => updateForm('dob', v)} />
            </View>
          )}

          {/* STEP 2: CONTACT & LOCATION */}
          {step === 2 && (
            <View>
              <Text style={styles.sectionLabel}>Contact & Location</Text>

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput style={[styles.input, { opacity: 0.7 }]} value={form.email} editable={false} />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.input} placeholderTextColor="#475569" placeholder="+1 (555) 000-0000" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => updateForm('phone', v)} />

              <Text style={styles.inputLabel}>Residential Address</Text>
              <TextInput style={styles.input} placeholderTextColor="#475569" placeholder="Street, City, Zip Code" value={form.address} onChangeText={(v) => updateForm('address', v)} />

              <Text style={styles.inputLabel}>Country of Residence</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowCountryModal(true)}>
                <Text style={form.country ? styles.inputText : styles.placeholderText}>{form.country || "Select Country"}</Text>
                <Ionicons name="chevron-down" size={16} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: REGULATORY ID */}
          {step === 3 && (
            <View>
              <Text style={styles.sectionLabel}>Regulatory Compliance</Text>
              <Text style={{ color: '#8E8E93', fontSize: 12, marginBottom: 20, lineHeight: 18 }}>
                Based on your selection of <Text style={{ color: '#D4AF37', fontWeight: 'bold' }}>{form.country}</Text>, financial regulations require us to collect specific identification numbers.
              </Text>

              <Text style={styles.inputLabel}>{getIdLabel()}</Text>
              <TextInput 
                style={styles.input} 
                placeholderTextColor="#475569" 
                placeholder={`Enter your ${getIdLabel().split('(')[0].trim()}`} 
                secureTextEntry 
                value={form.idNumber} 
                onChangeText={(v) => updateForm('idNumber', v)} 
              />
            </View>
          )}

          {/* 🚨 UPDATED STEP 4: DOCUMENT UPLOAD */}
          {step === 4 && (
            <View>
              <Text style={styles.sectionLabel}>Document Vault</Text>
              <Text style={styles.instructionsText}>
                Please provide a high-resolution scan or photo of your official Government ID, Driver's License, or Passport. 
                Ensure all text is legible, edges are visible, and there is no glare.
              </Text>
              
              <Text style={styles.inputLabel}>IDENTITY DOCUMENT (FRONT)</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdFront)}>
                {idFront ? (
                  <Image source={{ uri: idFront.uri }} style={styles.previewImage} />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={28} color="#94A3B8" />
                    <Text style={styles.uploadText}>Tap to capture front side</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 24 }]}>IDENTITY DOCUMENT (BACK)</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdBack)}>
                {idBack ? (
                  <Image source={{ uri: idBack.uri }} style={styles.previewImage} />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={28} color="#94A3B8" />
                    <Text style={styles.uploadText}>Tap to capture back side</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* NAVIGATION BUTTONS */}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {step < 4 ? (
              <TouchableOpacity style={[styles.nextBtn, step === 1 && { flex: 1 }]} onPress={nextStep}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={14} color="#05050A" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.nextBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#05050A" /> : <Text style={styles.nextBtnText}>Submit Application</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* SELECT MODALS */}
      <Modal visible={showGenderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {['Male', 'Female', 'Other'].map(g => (
              <TouchableOpacity key={g} style={styles.modalOption} onPress={() => { updateForm('gender', g); setShowGenderModal(false); }}>
                <Text style={styles.modalOptionText}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGenderModal(false)}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCountryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map(c => (
                <TouchableOpacity key={c} style={styles.modalOption} onPress={() => { updateForm('country', c); setShowCountryModal(false); }}>
                  <Text style={styles.modalOptionText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCountryModal(false)}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' },
  container: { flex: 1, backgroundColor: '#05050A' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  
  header: { padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 30, backgroundColor: '#12121A', borderBottomWidth: 1, borderBottomColor: '#1E1E28', marginBottom: 20 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 },
  
  progressContainer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressLine: { flex: 1, height: 4, borderRadius: 2 },
  progressActive: { backgroundColor: '#D4AF37' },
  progressInactive: { backgroundColor: '#1E1E28' },
  stepIndicator: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },

  statusTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  statusSub: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginBottom: 24 },

  formCard: { backgroundColor: '#12121A', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1E1E28' },
  sectionLabel: { color: '#D4AF37', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 20, textTransform: 'uppercase' },
  instructionsText: { color: '#8E8E93', fontSize: 12, marginBottom: 24, lineHeight: 18 },
  
  inputLabel: { color: '#8E8E93', fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#05050A', color: '#FFFFFF', borderWidth: 1, borderColor: '#1E1E28', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 20 },
  dropdown: { backgroundColor: '#05050A', borderWidth: 1, borderColor: '#1E1E28', borderRadius: 12, padding: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputText: { color: '#FFFFFF', fontSize: 14 },
  placeholderText: { color: '#475569', fontSize: 14 },
  
  uploadBox: { backgroundColor: '#05050A', borderWidth: 1, borderColor: '#1E1E28', borderStyle: 'dashed', borderRadius: 12, height: 140, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  uploadText: { color: '#636366', fontSize: 12, marginTop: 12, fontWeight: '600' },
  previewImage: { width: '100%', height: '100%' },

  navRow: { flexDirection: 'row', gap: 12, marginTop: 30 },
  prevBtn: { flex: 1, backgroundColor: '#1E1E28', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  prevBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  nextBtn: { flex: 2, flexDirection: 'row', gap: 8, backgroundColor: '#D4AF37', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  
  backBtn: { backgroundColor: '#1E1E28', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#12121A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E1E28' },
  modalOptionText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  modalCancel: { marginTop: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: '#1E1E28', borderRadius: 12 },
});
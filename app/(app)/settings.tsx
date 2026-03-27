import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Switch,
  Alert, ScrollView, Image, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

// ─── Premium Design Tokens ───────────────────────────────────────────────────
const T = {
  bg:      '#05050A',
  surface: '#0D1220',
  card:    '#12121A',
  border:  '#1E1E28',
  gold:    '#D4AF37',
  goldDim: 'rgba(212, 175, 55, 0.1)',
  green:   '#22C55E',
  greenDim:'rgba(34, 197, 94, 0.1)',
  red:     '#EF4444',
  redDim:  'rgba(239, 68, 68, 0.1)',
  text:    '#FFFFFF',
  muted:   '#636366',
  dim:     '#8E8E93',
};

const CURRENCIES = ['USD', 'GBP', 'EUR', 'BTC', 'USDT'];

export default function SettingsScreen() {
  const { user, setUser } = useAuthStore();

  // ─── State Management ───
  const [showKycForm, setShowKycForm] = useState(false);
  const [dob, setDob] = useState('');
  const [ssn, setSsn] = useState('');
  const [idCardDoc, setIdCardDoc] = useState<any>(null);
  const [govtIdDoc, setGovtIdDoc] = useState<any>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [baseCurrency, setBaseCurrency] = useState(user?.base_currency || 'USD');
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  const [is2FA, setIs2FA] = useState(user?.two_fa_enabled || false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 🚨 NEW: Payout Destinations State (Replaces Payment Methods)
  const [payoutAccounts, setPayoutAccounts] = useState<any[]>([]);
  const [showAddPayout, setShowAddPayout] = useState(false);
  const [payoutType, setPayoutType] = useState<'bank' | 'crypto'>('bank');
  
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState('BTC');

  // Load user's saved payout accounts (Note: You will need to create this endpoint in your backend)
  useEffect(() => { loadPayoutAccounts(); }, []);
  const loadPayoutAccounts = async () => {
    try {
      // Endpoint should map to a UserPayoutAccount model, NOT the Admin PaymentMethod model
      const res = await apiClient.get('/users/payout-accounts');
      setPayoutAccounts(res.data);
    } catch (_) {
      // Mock data for UI visual check until backend is built
      setPayoutAccounts([
        { id: '1', type: 'bank', label: 'Chase Checking', details: '**** 4567' }
      ]);
    }
  };

  // ─── Profile Logic ───
  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await apiClient.patch('/users/me', { full_name: fullName, base_currency: baseCurrency });
      setUser({ ...user, full_name: res.data.full_name, base_currency: res.data.base_currency });
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Update Failed', e.response?.data?.detail || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Needed', 'Storage access is required.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    const form = new FormData();
    form.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
    try {
      const res = await apiClient.post('/users/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser({ ...user, avatar_url: res.data.avatar_url });
    } catch (_) { Alert.alert('Upload Failed', 'Could not upload profile picture.'); }
  };

  // ─── Security Logic ───
  const toggle2FA = async (value: boolean) => {
    if (value) {
      try {
        await apiClient.post('/users/enable-2fa');
        Alert.alert('Verification', 'Please check your email for the 2FA code.', [
          { text: 'Enter Code', onPress: () => prompt2FACode() },
          { text: 'Cancel' },
        ]);
      } catch (_) { Alert.alert('Error', 'Could not start 2FA setup.'); }
    } else {
      Alert.alert('Disable 2FA', 'Are you sure you want to reduce your account security?', [
        { text: 'Disable', style: 'destructive', onPress: async () => {
          await apiClient.post('/users/disable-2fa');
          setIs2FA(false);
          setUser({ ...user, two_fa_enabled: false });
        }},
        { text: 'Keep Enabled' },
      ]);
    }
  };

  const prompt2FACode = () => {
    Alert.prompt('Enter Code', 'Input the 6-digit code sent to your email:', async (code) => {
      if (!code) return;
      try {
        await apiClient.post('/users/verify-2fa', { code });
        setIs2FA(true);
        setUser({ ...user, two_fa_enabled: true });
        Alert.alert('Success', 'Two-Factor Authentication is now enabled.');
      } catch (_) { Alert.alert('Invalid Code', 'The code you entered is incorrect or expired.'); }
    });
  };

  const changePassword = async () => {
    if (!oldPassword || !newPassword) return Alert.alert('Required Fields', 'Please enter your old and new password.');
    if (newPassword.length < 8) return Alert.alert('Invalid Password', 'New password must be at least 8 characters long.');
    try {
      await apiClient.post('/users/change-password', { old_password: oldPassword, new_password: newPassword });
      Alert.alert('Success', 'Your password has been changed.');
      setOldPassword(''); setNewPassword('');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to change password.'); }
  };

  // ─── Payout Destinations Logic ───
  const deletePayoutAccount = async (id: string) => {
    Alert.alert('Remove Account', 'Remove this withdrawal destination?', [
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/users/payout-accounts/${id}`);
          loadPayoutAccounts();
        } catch (_) { Alert.alert('Notice', 'Backend endpoint not connected yet.'); }
      }},
      { text: 'Cancel' },
    ]);
  };

  const addPayoutAccount = async () => {
    if (payoutType === 'bank' && (!bankName || !accountNumber)) return Alert.alert('Missing Data', 'Please enter bank details.');
    if (payoutType === 'crypto' && !cryptoAddress) return Alert.alert('Missing Data', 'Please enter your wallet address.');

    const payload = payoutType === 'bank' 
      ? { type: 'bank', label: bankName, details: accountNumber }
      : { type: 'crypto', label: `${cryptoNetwork} Wallet`, details: cryptoAddress };

    try {
      await apiClient.post('/users/payout-accounts', payload);
      setShowAddPayout(false);
      setBankName(''); setAccountNumber(''); setCryptoAddress('');
      loadPayoutAccounts();
    } catch (_) { 
      Alert.alert('Developer Notice', 'You need to build the POST /users/payout-accounts endpoint in FastAPI.'); 
    }
  };

  // ─── KYC Logic ───
  const appendFileToForm = (formData: FormData, key: string, doc: any) => {
    if (Platform.OS === 'web' && doc.file) {
      formData.append(key, doc.file);
    } else {
      formData.append(key, { uri: doc.uri, name: doc.name || 'document.jpg', type: doc.mimeType || 'image/jpeg' } as any);
    }
  };

  const handleKycSubmission = async () => {
    if (!dob || !ssn || !idCardDoc || !govtIdDoc) return Alert.alert("Missing Details", "Please fill in all fields.");
    setIsSubmittingKyc(true);
    try {
      const formData = new FormData();
      formData.append('dob', dob);
      formData.append('ssn', ssn);
      appendFileToForm(formData, 'id_card', idCardDoc);
      appendFileToForm(formData, 'govt_id', govtIdDoc);
      await apiClient.post('/users/kyc', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser({ ...user, kyc_status: 'pending' });
      setShowKycForm(false);
      Alert.alert('Success', 'Your KYC documents are pending review.');
    } catch (e: any) { Alert.alert('Submission Failed', e.response?.data?.detail || 'Server rejected documents.'); } 
    finally { setIsSubmittingKyc(false); }
  };

  return (
    <SafeAreaView style={st.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={st.container} contentContainerStyle={st.scrollContent} keyboardShouldPersistTaps="handled">
          
          <Text style={st.header}>Settings</Text>

          {/* ─── PROFILE SECTION ─── */}
          <Text style={st.sectionTitle}>PERSONAL PROFILE</Text>
          <View style={st.card}>
            <TouchableOpacity style={st.avatarRow} onPress={pickAvatar}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={st.avatar} /> : <View style={st.avatarPlaceholder}><Ionicons name="person" size={36} color={T.dim} /></View>}
              <View style={st.avatarBadge}><Ionicons name="camera" size={14} color={T.bg} /></View>
            </TouchableOpacity>
            <Text style={st.label}>FULL NAME</Text>
            <TextInput style={st.input} value={fullName} onChangeText={setFullName} placeholder="Enter your legal name" placeholderTextColor={T.muted} />
            <Text style={st.label}>DEFAULT CURRENCY</Text>
            <View style={st.currencyRow}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} style={[st.chip, baseCurrency === c && st.chipActive]} onPress={() => setBaseCurrency(c)}>
                  <Text style={[st.chipText, baseCurrency === c && st.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={st.btnGold} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color={T.bg} /> : <Text style={st.btnGoldText}>Save Profile</Text>}
            </TouchableOpacity>
          </View>

          {/* ─── KYC SECTION ─── */}
          <Text style={st.sectionTitle}>IDENTITY VERIFICATION (KYC)</Text>
          <View style={st.card}>
            <View style={st.row}>
              <View style={[st.iconBox, { backgroundColor: user?.kyc_status === 'verified' ? T.greenDim : T.goldDim }]}>
                <Ionicons name={user?.kyc_status === 'verified' ? 'checkmark-circle' : 'time'} size={24} color={user?.kyc_status === 'verified' ? T.green : T.gold} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={st.rowTitle}>KYC Status</Text>
                <Text style={[st.kycStatus, { color: user?.kyc_status === 'verified' ? T.green : user?.kyc_status === 'pending' ? T.gold : T.red }]}>
                  {(user?.kyc_status || 'UNVERIFIED').toUpperCase()}
                </Text>
              </View>
            </View>
            {user?.kyc_status === 'unverified' && !showKycForm && (
              <TouchableOpacity style={st.btnOutline} onPress={() => setShowKycForm(true)}>
                <Text style={st.btnOutlineText}>Start Verification</Text>
              </TouchableOpacity>
            )}
            {showKycForm && user?.kyc_status === 'unverified' && (
              <View style={st.formBox}>
                <Text style={st.label}>DATE OF BIRTH</Text>
                <TextInput style={st.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor={T.muted} keyboardType="numbers-and-punctuation" />
                <Text style={st.label}>SOCIAL SECURITY / NIN</Text>
                <TextInput style={st.input} value={ssn} onChangeText={setSsn} placeholder="Required for tax reporting" placeholderTextColor={T.muted} secureTextEntry keyboardType="numeric" />
                <Text style={st.label}>FRONT OF ID CARD</Text>
                <TouchableOpacity style={st.docBtn} onPress={async () => {
                  const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
                  if (!res.canceled) setIdCardDoc(res.assets[0]);
                }}>
                  <Ionicons name={idCardDoc ? "checkmark-circle" : "document-attach"} size={20} color={idCardDoc ? T.green : T.gold} style={{ marginRight: 10 }} />
                  <Text style={[st.docBtnText, idCardDoc && { color: T.text }]}>{idCardDoc ? idCardDoc.name : "Tap to upload ID"}</Text>
                </TouchableOpacity>
                <Text style={st.label}>GOVERNMENT LICENSE OR PASSPORT</Text>
                <TouchableOpacity style={st.docBtn} onPress={async () => {
                  const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
                  if (!res.canceled) setGovtIdDoc(res.assets[0]);
                }}>
                  <Ionicons name={govtIdDoc ? "checkmark-circle" : "document-attach"} size={20} color={govtIdDoc ? T.green : T.gold} style={{ marginRight: 10 }} />
                  <Text style={[st.docBtnText, govtIdDoc && { color: T.text }]}>{govtIdDoc ? govtIdDoc.name : "Tap to upload Passport/License"}</Text>
                </TouchableOpacity>
                <View style={st.actionRow}>
                  <TouchableOpacity style={st.btnGoldFlex} disabled={isSubmittingKyc} onPress={handleKycSubmission}>
                    {isSubmittingKyc ? <ActivityIndicator color={T.bg} /> : <Text style={st.btnGoldText}>Submit Documents</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={st.btnOutlineFlex} onPress={() => setShowKycForm(false)}>
                    <Text style={st.btnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ─── PAYOUT DESTINATIONS ─── */}
          <Text style={st.sectionTitle}>WITHDRAWAL DESTINATIONS</Text>
          <View style={st.card}>
            <Text style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>Configure where you want to receive your profits.</Text>
            
            {payoutAccounts.length === 0 && <Text style={st.emptyText}>No withdrawal routes saved.</Text>}
            
            {payoutAccounts.map(m => (
              <View key={m.id} style={st.methodRow}>
                <View style={st.methodIcon}><Ionicons name={m.type === 'bank' ? 'business' : 'logo-bitcoin'} size={20} color={T.text} /></View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={st.rowTitle}>{m.label}</Text>
                  <Text style={st.rowSub}>{m.details}</Text>
                </View>
                <TouchableOpacity onPress={() => deletePayoutAccount(m.id)}>
                  <View style={st.deleteBtn}><Ionicons name="trash" size={16} color={T.red} /></View>
                </TouchableOpacity>
              </View>
            ))}

            {showAddPayout ? (
              <View style={st.formBox}>
                <Text style={st.label}>ACCOUNT TYPE</Text>
                <View style={st.currencyRow}>
                  <TouchableOpacity style={[st.chip, payoutType === 'bank' && st.chipActive]} onPress={() => setPayoutType('bank')}>
                    <Text style={[st.chipText, payoutType === 'bank' && st.chipTextActive]}>BANK ACCOUNT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.chip, payoutType === 'crypto' && st.chipActive]} onPress={() => setPayoutType('crypto')}>
                    <Text style={[st.chipText, payoutType === 'crypto' && st.chipTextActive]}>CRYPTO WALLET</Text>
                  </TouchableOpacity>
                </View>

                {payoutType === 'bank' ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={st.label}>BANK NAME</Text>
                    <TextInput style={st.input} value={bankName} onChangeText={setBankName} placeholder="e.g. Chase Bank" placeholderTextColor={T.muted} />
                    <Text style={st.label}>ACCOUNT NUMBER</Text>
                    <TextInput style={st.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="0000000000" keyboardType="number-pad" placeholderTextColor={T.muted} />
                  </View>
                ) : (
                  <View style={{ marginTop: 16 }}>
                    <Text style={st.label}>NETWORK</Text>
                    <TextInput style={st.input} value={cryptoNetwork} onChangeText={setCryptoNetwork} placeholder="BTC, ERC20, TRC20" placeholderTextColor={T.muted} />
                    <Text style={st.label}>WALLET ADDRESS</Text>
                    <TextInput style={st.input} value={cryptoAddress} onChangeText={setCryptoAddress} placeholder="bc1qxy2kg..." placeholderTextColor={T.muted} />
                  </View>
                )}

                <View style={st.actionRow}>
                  <TouchableOpacity style={st.btnGoldFlex} onPress={addPayoutAccount}>
                    <Text style={st.btnGoldText}>Save Route</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.btnOutlineFlex} onPress={() => setShowAddPayout(false)}>
                    <Text style={st.btnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={st.btnOutline} onPress={() => setShowAddPayout(true)}>
                <Ionicons name="add" size={18} color={T.gold} style={{ marginRight: 8 }} />
                <Text style={st.btnOutlineText}>Add Withdrawal Route</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─── SECURITY SECTION ─── */}
          <Text style={st.sectionTitle}>ACCOUNT SECURITY</Text>
          <View style={st.card}>
            <View style={st.row}>
              <View style={[st.iconBox, { backgroundColor: T.border }]}><Ionicons name="lock-closed" size={20} color={T.text} /></View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={st.rowTitle}>Two-Factor Auth</Text>
                <Text style={st.rowSub}>Require email OTP on login</Text>
              </View>
              <Switch value={is2FA} onValueChange={toggle2FA} trackColor={{ true: T.green, false: T.border }} thumbColor={T.text} />
            </View>
            <View style={st.divider} />
            <Text style={st.label}>CURRENT PASSWORD</Text>
            <TextInput style={st.input} value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={T.muted} />
            <Text style={st.label}>NEW PASSWORD</Text>
            <TextInput style={st.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Must be 8+ characters" placeholderTextColor={T.muted} />
            <TouchableOpacity style={st.btnOutline} onPress={changePassword}>
              <Text style={st.btnOutlineText}>Change Password</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Stunning UI Styles ───────────────────────────────────────────────────────
const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  
  header: { color: T.text, fontSize: 32, fontWeight: '900', letterSpacing: 0.5, marginBottom: 32 },
  sectionTitle: { color: T.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
  card: { backgroundColor: T.surface, borderRadius: 20, padding: 24, marginBottom: 32, borderWidth: 1, borderColor: T.border, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  
  avatarRow: { alignSelf: 'center', marginBottom: 28 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: T.gold },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: T.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.border },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: T.gold, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: T.surface },
  
  label: { color: T.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 20 },
  input: { backgroundColor: T.card, color: T.text, borderRadius: 14, padding: 18, fontSize: 16, fontWeight: '500', borderWidth: 1, borderColor: T.border },
  
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.goldDim, borderColor: T.gold },
  chipText: { color: T.dim, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: T.gold, fontWeight: '800' },
  
  btnGold: { backgroundColor: T.gold, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 32, shadowColor: T.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnGoldText: { color: T.bg, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  btnGoldFlex: { flex: 1, backgroundColor: T.gold, padding: 18, borderRadius: 14, alignItems: 'center' },
  
  btnOutline: { borderWidth: 1, borderColor: T.border, padding: 18, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  btnOutlineFlex: { flex: 1, borderWidth: 1, borderColor: T.border, padding: 18, borderRadius: 14, alignItems: 'center' },
  btnOutlineText: { color: T.text, fontWeight: '700', fontSize: 14 },
  
  divider: { height: 1, backgroundColor: T.border, marginVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: T.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.border },
  rowTitle: { color: T.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: T.dim, fontSize: 13, marginTop: 4, fontWeight: '500' },
  
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: T.border },
  methodIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.border, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: T.green, fontSize: 12, fontWeight: '700', marginTop: 4 },
  emptyText: { color: T.dim, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.redDim, justifyContent: 'center', alignItems: 'center' },
  
  kycStatus: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  formBox: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: T.border },
  docBtn: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  docBtnText: { color: T.dim, fontSize: 14, fontWeight: '600', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
});
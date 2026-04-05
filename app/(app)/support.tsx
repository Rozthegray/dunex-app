import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, SafeAreaView, Modal, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';
import * as DocumentPicker from 'expo-document-picker';

export default function SecureSupportScreen() {
  const { user } = useAuthStore();
  
  // Form State
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<any>(null);
  
  // UI State
  const [isSending, setIsSending] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets.length > 0) {
        setAttachment(result.assets[0]);
      }
    } catch (err) {
      console.log("Document picker error", err);
    }
  };

  const handleSendTicket = async () => {
    if (!subject.trim() || !message.trim() || !email.trim()) {
      return Alert.alert('Validation Error', 'Email, Subject, and Message details are required.');
    }

    setIsSending(true);
    try {
      let finalAttachmentUrl = null;

      // 🚨 CLOUDINARY UPLOAD LOGIC 🚨
      if (attachment) {
        const data = new FormData();
        data.append('file', {
          uri: attachment.uri,
          type: attachment.mimeType || 'image/jpeg',
          name: attachment.name,
        } as any);
        
        // 🚨 Replace these with your actual Cloudinary details!
        data.append('upload_preset', 'dunex_support_uploads'); // Must be an "Unsigned" preset!
        data.append('cloud_name', 'dkpicfvgv');

        const cloudRes = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
          method: 'POST',
          body: data,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const cloudData = await cloudRes.json();
        
        if (cloudData.secure_url) {
          finalAttachmentUrl = cloudData.secure_url; // This is the real web link!
        } else {
          throw new Error('Image upload failed');
        }
      }

      // Now send the ticket to your backend with the REAL link
      const payload = {
        name,
        email,
        subject,
        message,
        attachment_url: finalAttachmentUrl 
      };

      await apiClient.post('/chat/support/ticket', payload);
      
      // Clear form and trigger the success modal
      setSubject('');
      setMessage('');
      setAttachment(null);
      setIsModalOpen(true);

    } catch (error) {
      Alert.alert('Transmission Failure', 'Failed to send your message. Please try again or email support directly.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.iconHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="chatbubbles" size={32} color="#D4AF37" />
          </View>
          <Text style={styles.headerTitle}>DUNEX SUPPORT</Text>
          <Text style={styles.headerSubtitle}>
            Send us a message below, or email us directly with attachments at <Text style={{fontWeight: 'bold', color: '#D4AF37'}}>support@dunexmarkets.com</Text>
          </Text>
        </View>

        {/* FORM CARD */}
        <View style={styles.form}>
          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. John Doe" 
            placeholderTextColor="#636366" 
            value={name} 
            onChangeText={setName} 
            editable={!user?.full_name} 
          />

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput 
            style={styles.input} 
            placeholder="your@email.com" 
            placeholderTextColor="#636366" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none" 
            editable={!user?.email} 
          />

          <Text style={styles.label}>WHAT DO YOU NEED HELP WITH?</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Help with a deposit" 
            placeholderTextColor="#636366" 
            value={subject} 
            onChangeText={setSubject} 
          />
          
          <Text style={styles.label}>MESSAGE DETAILS</Text>
          <TextInput 
            style={[styles.input, { height: 120, textAlignVertical: 'top', paddingTop: 16 }]} 
            placeholder="Please explain how we can assist you..." 
            placeholderTextColor="#636366" 
            multiline 
            value={message} 
            onChangeText={setMessage} 
          />

          {/* ATTACHMENT UPLOAD */}
          <Text style={styles.label}>ATTACH SCREENSHOT (OPTIONAL)</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={pickDocument} activeOpacity={0.7}>
            <View style={styles.attachIconBox}>
              <Ionicons name="image" size={16} color="#D4AF37" />
            </View>
            <Text style={[styles.attachText, attachment && { color: '#FFFFFF', fontWeight: 'bold' }]} numberOfLines={1}>
              {attachment ? attachment.name : "Tap to select a picture"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.btn, isSending && { opacity: 0.5 }]} 
            onPress={handleSendTicket} 
            disabled={isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator color="#05050A" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#05050A" style={{ marginRight: 10 }} />
                <Text style={styles.btnText}>SEND MESSAGE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FRIENDLY SUCCESS MODAL */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#D4AF37" />
            </View>
            <Text style={styles.modalTitle}>Message Sent!</Text>
            <Text style={styles.modalMessage}>
              Thank you for reaching out. Our support team has received your message and will reply to your email address shortly.
            </Text>
            <TouchableOpacity 
              style={styles.modalBtn} 
              onPress={() => setIsModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05050A' }, 
  container: { flex: 1, paddingHorizontal: 20 },
  
  iconHeader: { alignItems: 'center', marginTop: Platform.OS === 'ios' ? 20 : 40, marginBottom: 30 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(212, 175, 55, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  headerSubtitle: { color: '#8E8E93', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '500', paddingHorizontal: 10, lineHeight: 20 },
  
  form: { backgroundColor: '#12121A', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#1E1E28', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  label: { color: '#8E8E93', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  
  input: { backgroundColor: '#05050A', color: '#FFFFFF', borderRadius: 12, padding: 16, fontSize: 14, marginBottom: 24, borderWidth: 1, borderColor: '#1E1E28', fontWeight: '500' },
  
  attachBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#05050A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E1E28', borderStyle: 'dashed', marginBottom: 32 },
  attachIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#12121A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28' },
  attachText: { color: '#636366', marginLeft: 12, fontSize: 13, fontWeight: '600', flex: 1 },
  
  btn: { flexDirection: 'row', backgroundColor: '#D4AF37', paddingVertical: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  btnText: { color: '#05050A', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 10, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#12121A', borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E28', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 40, elevation: 20 },
  modalIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212, 175, 55, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalMessage: { color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '500' },
  modalBtn: { backgroundColor: '#1E1E28', width: '100%', paddingVertical: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A4A' },
  modalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
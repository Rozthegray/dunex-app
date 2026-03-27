import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../lib/authStore';

// ─────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  sender_type: 'user' | 'admin';
  content: string;
  created_at: string;
  status?: 'sending' | 'delivered' | 'read';
  is_preset?: boolean;
  pending?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 25_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS  = 30_000;
const TYPING_STOP_DELAY_MS    = 1_500;
const ADMIN_TYPING_TIMEOUT_MS = 3_500;

// ─────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────
const TypingDots = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150), Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.delay(600)
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 2 }}>
      {dots.map((d, i) => <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b', transform: [{ translateY: d }] }} />)}
    </View>
  );
};

const StatusIcon = ({ status }: { status?: string }) => {
  if (status === 'sending')   return <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.45)" />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={11} color="rgba(255,255,255,0.65)" />;
  if (status === 'read')      return <Ionicons name="checkmark-done" size={11} color="#38bdf8" />;
  return null;
};

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function ChatScreen() {
  const router = useRouter();
  
  // 🛑 THE FIX: Pull checkSession so we can force a recovery if memory drops
  const { user, isLoading: authLoading, checkSession } = useAuthStore();

  // Safely extract the ID no matter how FastAPI returned it
  const userId = user?.id || user?.data?.id || user?.user_id;

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [inputText, setInputText]     = useState('');
  const [isLoading, setIsLoading]     = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);

  const ws                = useRef<WebSocket | null>(null);
  const wsUrlRef          = useRef('');
  const flatListRef       = useRef<FlatList>(null);
  const isMounted         = useRef(true);
  const reconnectAttempts = useRef(0);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminTypingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef       = useRef(false);

  // ── Auto-Recovery ──────────────────────────────────────────
  useEffect(() => {
    if (!userId && !authLoading) {
      console.log("User ID missing in Chat, forcing session check...");
      checkSession();
    }
  }, [userId, authLoading, checkSession]);

  const scrollToBottom = useCallback(() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80), []);
  const stopHeartbeat = useCallback(() => { if (heartbeatTimer.current) clearInterval(heartbeatTimer.current); heartbeatTimer.current = null; }, []);
  const startHeartbeat = useCallback(() => { stopHeartbeat(); heartbeatTimer.current = setInterval(() => ws.current?.readyState === WebSocket.OPEN && ws.current.send('ping'), HEARTBEAT_INTERVAL_MS); }, [stopHeartbeat]);
  const sendTypingIndicator = useCallback((typing: boolean) => ws.current?.readyState === WebSocket.OPEN && ws.current.send(JSON.stringify({ type: 'typing', is_typing: typing })), []);

  // ── WebSocket Connect ──────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (!isMounted.current || !wsUrlRef.current) return;
    if (ws.current) {
      ws.current.onclose = null;
      if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(ws.current.readyState as any)) ws.current.close();
    }

    const socket = new WebSocket(wsUrlRef.current);
    ws.current = socket;

    socket.onopen = () => {
      if (!isMounted.current) return;
      setIsConnected(true);
      reconnectAttempts.current = 0;
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      if (!isMounted.current || event.data === 'pong') return;
      let payload: any;
      try { payload = JSON.parse(event.data); } catch { return; }

      if (payload.type === 'message') {
        const incoming: ChatMessage = { id: payload.id, sender_type: payload.sender_type, content: payload.content, created_at: payload.created_at, status: payload.status || 'delivered', is_preset: payload.is_preset };
        setMessages(prev => {
          if (incoming.sender_type === 'user') {
            const idx = prev.findIndex(m => m.pending && m.content === incoming.content);
            if (idx !== -1) { const next = [...prev]; next[idx] = incoming; return next; }
          }
          if (prev.some(m => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        scrollToBottom();
      }
      else if (payload.type === 'typing') {
        setAdminTyping(payload.is_typing);
        if (adminTypingTimer.current) clearTimeout(adminTypingTimer.current);
        if (payload.is_typing) adminTypingTimer.current = setTimeout(() => setAdminTyping(false), ADMIN_TYPING_TIMEOUT_MS);
      }
      else if (payload.type === 'read_receipt' && payload.all_read) {
        setMessages(prev => prev.map(m => m.sender_type === 'user' ? { ...m, status: 'read' } : m));
      }
    };

    socket.onclose = (event) => {
      if (!isMounted.current) return;
      setIsConnected(false);
      stopHeartbeat();
      if (event.code === 1000) return;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts.current, MAX_RECONNECT_DELAY_MS);
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(connectWebSocket, delay);
    };
  }, [startHeartbeat, stopHeartbeat, scrollToBottom]);

  // ── Initialise ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setIsLoading(false); return; }

    isMounted.current = true;

    (async () => {
      if (Platform.OS === 'web') return;
      try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const tokenData: any = await Promise.race([Notifications.getExpoPushTokenAsync(), new Promise((_, rej) => setTimeout(() => rej('timeout'), 3000))]);
          await apiClient.post('/users/push-token', { token: tokenData.data });
        }
      } catch { /* silent */ }
    })();

    (async () => {
      try {
        const res = await apiClient.get('/chat/history');
        const data = res.data;
        if (isMounted.current) setMessages(Array.isArray(data) ? data : (data.messages ?? []));
      } catch (err) { console.error('[Chat] History fetch failed:', err); }

      const base = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';
      let url = `${base.replace(/^http/i, 'ws').replace(/^https/i, 'wss')}/chat/ws/chat/${userId}`;
      if (Platform.OS === 'android' && /127\.0\.0\.1|localhost/.test(base)) {
        url = `ws://10.0.2.2:8000/api/v1/chat/ws/chat/${userId}`;
      }
      wsUrlRef.current = url;

      if (isMounted.current) { setIsLoading(false); connectWebSocket(); }
    })();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (adminTypingTimer.current) clearTimeout(adminTypingTimer.current);
      stopHeartbeat();
      sendTypingIndicator(false);
      if (ws.current) { ws.current.onclose = null; ws.current.close(1000, 'Unmounted'); }
    };
  }, [userId, authLoading, connectWebSocket, stopHeartbeat, sendTypingIndicator]);

  // ── Send Message ──────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const content = inputText.trim();
    if (!content) return;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) { Alert.alert('Not Connected', 'Please wait while we reconnect…'); return; }

    const tempId = `pending-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, sender_type: 'user', content, created_at: new Date().toISOString(), status: 'sending', pending: true }]);
    setInputText('');
    scrollToBottom();

    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTypingRef.current = false;
    sendTypingIndicator(false);
    ws.current.send(JSON.stringify({ type: 'message', content }));
  }, [inputText, scrollToBottom, sendTypingIndicator]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    if (!isTypingRef.current && text.length > 0) { isTypingRef.current = true; sendTypingIndicator(true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (text.length === 0) { isTypingRef.current = false; sendTypingIndicator(false); } 
    else { typingTimer.current = setTimeout(() => { isTypingRef.current = false; sendTypingIndicator(false); }, TYPING_STOP_DELAY_MS); }
  }, [sendTypingIndicator]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.sender_type === 'user';
    const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <View style={[styles.messageWrapper, isUser ? styles.wrapUser : styles.wrapAdmin]}>
        {!isUser && <View style={styles.adminAvatar}><Ionicons name="headset" size={16} color="#fff" /></View>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAdmin, item.pending && styles.bubblePending]}>
          <Text style={styles.messageText}>{item.content}</Text>
          <View style={styles.msgMeta}>
            {!!timeStr && <Text style={[styles.timeText, isUser ? styles.timeUser : styles.timeAdmin]}>{timeStr}</Text>}
            {isUser && <StatusIcon status={item.status} />}
          </View>
        </View>
      </View>
    );
  }, []);

  const renderFooter = useCallback(() => {
    if (!adminTyping) return null;
    return (
      <View style={[styles.messageWrapper, styles.wrapAdmin]}>
        <View style={styles.adminAvatar}><Ionicons name="headset" size={16} color="#fff" /></View>
        <View style={[styles.bubble, styles.bubbleAdmin]}><TypingDots /></View>
      </View>
    );
  }, [adminTyping]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (isLoading || authLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Live Support</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#475569" />
          <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16, fontWeight: 'bold' }}>Authentication Required</Text>
          <Text style={{ color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22, marginBottom: 24 }}>
            Your session memory was cleared. Click below to reconnect to the server.
          </Text>
          <TouchableOpacity 
            onPress={() => checkSession()} 
            style={{ backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Force Refresh Session</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Support</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.statusText, { color: isConnected ? '#10b981' : '#ef4444' }]}>{isConnected ? 'Connected' : 'Reconnecting…'}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef} data={messages} keyExtractor={(item) => item.id} renderItem={renderMessage}
          contentContainerStyle={styles.chatList} onContentSizeChange={scrollToBottom} ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false} removeClippedSubviews={false}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input} placeholder="Type a message…" placeholderTextColor="#64748b" value={inputText}
            onChangeText={handleInputChange} multiline onSubmitEditing={sendMessage} returnKeyType="send" blurOnSubmit={false}
          />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!inputText.trim()}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center:          { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  container:       { flex: 1, backgroundColor: '#0f172a' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn:         { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12 },
  headerCenter:    { alignItems: 'center' },
  headerTitle:     { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statusRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot:       { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText:      { fontSize: 11, fontWeight: '600' },
  chatList:        { padding: 20, paddingBottom: 12 },
  messageWrapper:  { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  wrapUser:        { justifyContent: 'flex-end' },
  wrapAdmin:       { justifyContent: 'flex-start' },
  adminAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  bubble:          { maxWidth: '80%', padding: 14, borderRadius: 20 },
  bubbleUser:      { backgroundColor: '#3b82f6', borderBottomRightRadius: 4 },
  bubbleAdmin:     { backgroundColor: '#1e293b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
  bubblePending:   { opacity: 0.65 },
  messageText:     { color: '#fff', fontSize: 15, lineHeight: 22 },
  msgMeta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  timeText:        { fontSize: 10 },
  timeUser:        { color: 'rgba(255,255,255,0.6)' },
  timeAdmin:       { color: '#64748b' },
  inputContainer:  { flexDirection: 'row', alignItems: 'flex-end', padding: 14, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  input:           { flex: 1, backgroundColor: '#0f172a', color: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#334155' },
  sendBtn:         { width: 46, height: 46, borderRadius: 23, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 1 },
  sendBtnDisabled: { opacity: 0.4 },
});
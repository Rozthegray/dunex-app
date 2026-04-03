/**
 * market.tsx
 * Read-Only Live Crypto Market List.
 * Users browse live prices for situational awareness (No direct execution).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
  SafeAreaView, StatusBar, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarketData } from '../../hooks/useMarketData';
import type { MarketAsset } from '../../types/trading';

// ─── Coin colour map (Used as a fallback for obscure coins) ───────────────
const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff',
  BNB: '#f3ba2f', XRP: '#00aae4', ADA: '#0033ad',
  DOGE: '#c3a634', AVAX: '#e84142', DOT: '#e6007a',
  MATIC: '#8247e5', LTC: '#bfbbbb', LINK: '#2a5ada',
};

// Generates a consistent hash color for coins not in the hardcoded list
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const coinColor = (symbol: string) => COIN_COLORS[symbol] ?? generateColor(symbol);

// ─── Smart Coin Symbol Component ─────────────────────────────────────────────
function CoinSymbol({ symbol }: { symbol: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  
  // Pulls high-res icons from a lightning-fast global GitHub CDN
  const iconUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;

  if (imageFailed) {
    // If the coin is too obscure and the CDN fails, fallback to the colored circle
    return (
      <View style={[styles.coinCircle, { backgroundColor: coinColor(symbol) + '22' }]}>
        <Text style={[styles.coinLetter, { color: coinColor(symbol) }]}>
          {symbol.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: iconUrl }} 
      style={styles.coinImage} 
      onError={() => setImageFailed(true)}
    />
  );
}

function PriceChangeTag({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <View style={[styles.changeBadge, { backgroundColor: up ? '#10b98122' : '#ef444422' }]}>
      <Ionicons name={up ? 'caret-up' : 'caret-down'} size={10} color={up ? '#10b981' : '#ef4444'} />
      <Text style={[styles.changeText, { color: up ? '#10b981' : '#ef4444' }]}>
        {Math.abs(pct).toFixed(2)}%
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MarketScreen() {
  const { assets, isLoading, isRefreshing, lastUpdated, refresh } = useMarketData();
  const [search, setSearch] = useState('');

  const filtered = assets.filter(a =>
    a.symbol.includes(search.toUpperCase()) || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderAsset = ({ item }: { item: MarketAsset }) => (
    <View style={styles.assetRow}>
      <CoinSymbol symbol={item.symbol} />
      <View style={styles.assetMid}>
        <Text style={styles.assetSymbol}>{item.symbol}</Text>
        <Text style={styles.assetName}>{item.name}</Text>
      </View>
      <View style={styles.assetRight}>
        <Text style={styles.assetPrice}>
          ${item.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: item.current_price > 1 ? 2 : 6 })}
        </Text>
        <PriceChangeTag pct={item.price_change_percent} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Live Markets</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>
              Global Market Feed • Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#475569" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search global assets..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#475569" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Syncing feed…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.symbol}
          renderItem={renderAsset}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Optimization props for large lists
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#D4AF37" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color="#475569" />
              <Text style={styles.emptyText}>No assets match "{search}"</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#475569', fontSize: 11, marginTop: 4, letterSpacing: 0.5 },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', marginHorizontal: 20, marginBottom: 16,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 16 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  assetRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e293b',
  },
  // Replaces the old circle for actual images
  coinImage: {
    width: 44, height: 44, borderRadius: 22, marginRight: 14,
  },
  // Fallback circle styles
  coinCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  coinLetter: { fontSize: 16, fontWeight: '900' },

  assetMid: { flex: 1 },
  assetSymbol: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  assetName: { color: '#64748b', fontSize: 12, marginTop: 2 },

  assetRight: { alignItems: 'flex-end', marginRight: 4 },
  assetPrice: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', marginBottom: 4 },

  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  changeText: { fontSize: 11, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { color: '#475569', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#475569', marginTop: 12, fontSize: 16 },
});
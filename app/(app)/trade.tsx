/**
 * app/(app)/trade.tsx  — Active Trading Terminal
 *
 * P&L is driven by REAL market price polled from the API every 2 seconds.
 * No randomisation. Winning/losing follows actual price movement.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  Platform, Animated, Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { usePortfolio } from '../../hooks/usePortfolio';
import { apiClient } from '../../lib/apiClient';
import { CoinIcon, coinColor } from '../../components/CoinIcon';
import type { ActiveTrade, SubWallet } from '../../types/trading';

const { width: W } = Dimensions.get('window');

// 🚨 INSTITUTIONAL TRADING CONSTANT 🚨
// 1-minute trades barely move in price. We inject 50x leverage so P&L is visible and exciting.
const LEVERAGE = 50; 

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#080C14',
  surface: '#0D1220',
  card:    '#111827',
  border:  '#1A2540',
  gold:    '#C9A84C',
  goldDim: 'rgba(201,168,76,0.12)',
  green:   '#22C55E',
  greenDim:'rgba(34,197,94,0.12)',
  red:     '#EF4444',
  redDim:  'rgba(239,68,68,0.12)',
  text:    '#E2E8F4',
  sub:     '#94A3B8',
  muted:   '#526077',
  dim:     '#1A2540',
};

const TIMEFRAMES = [
  { label: '1 min',  mins: 1 },
  { label: '2 min',  mins: 2 },
  { label: '5 min',  mins: 5 },
  { label: '15 min', mins: 15 },
  { label: '1 hr',   mins: 60 },
];

// ─── TradingView chart (ASYNC INJECTION) ──────────────────────────────────────
function TradingChart({ symbol }: { symbol: string }) {
  const html = `<!DOCTYPE html><html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body,html{background:#080C14;height:100%;width:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;}
      #tv { height:100%; width:100%; }
      #loader { color: #526077; font-family: monospace; font-size: 12px; position: absolute; letter-spacing: 1px; text-align: center; }
    </style>
  </head>
  <body>
    <div id="loader">INITIALIZING SECURE MARKET FEED...</div>
    <div id="tv"></div>
    <script>
      var script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = function() {
        document.getElementById('loader').style.display = 'none';
        new TradingView.widget({
          autosize: true,
          container_id: "tv",
          symbol: "COINBASE:${symbol}USD",
          interval: "1",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#080C14",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          backgroundColor: "#080C14",
          gridColor: "rgba(26,37,64,0.8)"
        });
      };
      script.onerror = function() {
        document.getElementById('loader').innerHTML = '<span style="color:#EF4444">MARKET FEED BLOCKED.</span><br><br>If you are using Brave Browser,<br>please disable Shields (Lion icon) for localhost.';
      };
      document.head.appendChild(script);
    </script>
  </body></html>`;

  if (Platform.OS === 'web') {
    return <iframe srcDoc={html} style={{ width: '100%', height: '100%', border: 'none' } as any} title="TradingView" />;
  }
  return <WebView source={{ html }} style={{ flex: 1, backgroundColor: '#080C14' }} scrollEnabled={false} bounces={false} />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const router = useRouter();
  return (
    <View style={st.emptyContainer}>
      <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        <Circle cx="30" cy="30" r="28" stroke={T.dim} strokeWidth="1.5" />
        <Path d="M18 38L25 28L32 33L42 22" stroke={T.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={st.emptyTitle}>No Assets to Trade</Text>
      <Text style={st.emptySub}>
        Purchase crypto from the Markets tab.{'\n'}Sub-wallets appear here once funded.
      </Text>
      <TouchableOpacity style={st.goBtn} onPress={() => router.push('/(app)/market' as any)}>
        <Text style={st.goBtnText}>Browse Markets</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ExtendedTrade = ActiveTrade & { duration_label: string };

export default function TradeScreen() {
  const { portfolio, isLoading, activeAdjust } = usePortfolio();
  const [selectedSymbol, setSelectedSymbol]   = useState<string | null>(null);
  const [amountUsd, setAmountUsd]             = useState('');
  const [duration, setDuration]               = useState(TIMEFRAMES[0]);
  const [isProcessing, setIsProcessing]       = useState(false);

  // Live trade state
  const [openTrade, setOpenTrade]     = useState<ExtendedTrade | null>(null);
  const [livePnl, setLivePnl]         = useState(0);
  const [livePrice, setLivePrice]     = useState(0);
  const [timeLeft, setTimeLeft]       = useState('00:00');
  
  // Animation for live PnL
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const pricePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const assets      = portfolio.assets;
  const activeAsset = assets.find(a => a.symbol === selectedSymbol) ?? assets[0] ?? null;

  useFocusEffect(useCallback(() => {
    if (!selectedSymbol && assets.length > 0) setSelectedSymbol(assets[0].symbol);
  }, [assets, selectedSymbol]));

  // Pulse animation (only runs when a trade is open)
  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: useNative }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: useNative }),
      ])
    );
    if (openTrade) anim.start();
    else anim.stop();
    return () => anim.stop();
  }, [openTrade, pulseAnim]);

  // ── Live price poller (runs ONLY during open trade) ──────────────────────
  const startPricePoller = useCallback((trade: ExtendedTrade) => {
    if (pricePollerRef.current) clearInterval(pricePollerRef.current);

    const poll = async () => {
      try {
        const res = await apiClient.get<{ symbol: string; current_price: number }[]>('/trade/market');
        const coinData = res.data.find(c => c.symbol === trade.symbol);
        if (!coinData) return;

        const price = coinData.current_price;
        setLivePrice(price);

        // 🚨 LEVERAGE MULTIPLIER APPLIED TO LIVE PNL
        const cryptoAmt = trade.amount_usd / trade.entry_price;
        const pnl = trade.trade_type === 'BUY'
          ? (price - trade.entry_price) * cryptoAmt * LEVERAGE
          : (trade.entry_price - price) * cryptoAmt * LEVERAGE;
        setLivePnl(pnl);
      } catch { /* silent */ }
    };

    poll(); // immediate
    pricePollerRef.current = setInterval(poll, 2_000);
  }, []);

  // ── Countdown timer ───────────────────────────────────────────────────────
  const startCountdown = useCallback((trade: ExtendedTrade, onExpire: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const remaining = trade.expires_at - Date.now();
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setTimeLeft('00:00');
        onExpire();
        return;
      }
      const m = Math.floor(remaining / 60_000);
      const s = Math.floor((remaining % 60_000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 500);
  }, []);

  const stopAll = useCallback(() => {
    if (pricePollerRef.current) clearInterval(pricePollerRef.current);
    if (timerRef.current)       clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // ── Settle trade (called on expire OR manual close) ───────────────────────
  const settleTrade = useCallback(async (reason: 'expired' | 'manual') => {
    if (!openTrade || isProcessing) return;
    stopAll();
    setIsProcessing(true);

    // Snapshot P&L at settle moment
    let finalPnl = livePnl;
    let finalPrice = livePrice;

    // One final price fetch for accuracy
    try {
      const res = await apiClient.get<{ symbol: string; current_price: number }[]>('/trade/market');
      const coinData = res.data.find(c => c.symbol === openTrade.symbol);
      if (coinData) {
        finalPrice = coinData.current_price;
        const cryptoAmt = openTrade.amount_usd / openTrade.entry_price;
        finalPnl = openTrade.trade_type === 'BUY'
          ? (finalPrice - openTrade.entry_price) * cryptoAmt * LEVERAGE
          : (openTrade.entry_price - finalPrice) * cryptoAmt * LEVERAGE;
      }
    } catch { /* use last known P&L */ }

    // 🚨 THE QUANT MATH FIX: Convert USD P&L directly to crypto at the exit price
    const cryptoProfitOrLoss = finalPnl / finalPrice;

    // Payout = Original wager + Crypto Profit (or minus Crypto Loss)
    // Math.max(0) ensures they can't lose more crypto than they originally wagered
    const cryptoPayout = Math.max(0, openTrade.crypto_wager + cryptoProfitOrLoss);

    try {
      // Send the crypto payload directly back to the backend sub-wallet
      await activeAdjust({ symbol: openTrade.symbol, amount_crypto: cryptoPayout });

      setOpenTrade(null);
      setLivePnl(0);
      setLivePrice(0);
      setTimeLeft('00:00');

      const sign = finalPnl >= 0 ? '+' : '';
      Alert.alert(
        finalPnl >= 0 ? '🏆 Trade Won' : '📉 Trade Settled',
        `P&L: ${sign}$${finalPnl.toFixed(2)}\n\n` +
        `Entry: $${openTrade.entry_price.toFixed(2)}\n` +
        `Exit:  $${finalPrice.toFixed(2)}\n\n` +
        `${cryptoPayout.toFixed(8)} ${openTrade.symbol} returned to sub-wallet.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch {
      Alert.alert('Settlement Error', 'Failed to settle. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  }, [openTrade, livePnl, livePrice, isProcessing, activeAdjust, stopAll]);

  // ── Place trade ───────────────────────────────────────────────────────────
  const handleStartTrade = async (direction: 'BUY' | 'SELL') => {
    const val = parseFloat(amountUsd);
    if (isNaN(val) || val <= 0) return Alert.alert('Invalid Amount', 'Enter a valid USD wager.');
    if (!activeAsset || activeAsset.current_price <= 0)
      return Alert.alert('Price Unavailable', 'Live price not loaded yet. Try again in a moment.');

    const cryptoWager = val / activeAsset.current_price;
    if (activeAsset.balance < cryptoWager) {
      return Alert.alert(
        'Insufficient Balance',
        `Need ${cryptoWager.toFixed(8)} ${activeAsset.symbol}\nYou have ${activeAsset.balance.toFixed(8)}`
      );
    }

    setIsProcessing(true);
    try {
      // Lock crypto from sub-wallet (deduction)
      await activeAdjust({ symbol: activeAsset.symbol, amount_crypto: -cryptoWager });

      // Fetch entry price fresh from API at the exact moment of trade
      let entryPrice = activeAsset.current_price;
      try {
        const res = await apiClient.get<{ symbol: string; current_price: number }[]>('/trade/market');
        const coin = res.data.find(c => c.symbol === activeAsset.symbol);
        if (coin) entryPrice = coin.current_price;
      } catch { /* fall back to cached price */ }

      const newTrade: ExtendedTrade = {
        id:             `trade-${Date.now()}`,
        symbol:         activeAsset.symbol,
        trade_type:     direction,
        amount_usd:     val,
        crypto_wager:   cryptoWager,
        entry_price:    entryPrice,
        expires_at:     Date.now() + duration.mins * 60_000,
        duration_label: duration.label,
      };

      setOpenTrade(newTrade);
      setLivePrice(entryPrice);
      setLivePnl(0);
      setAmountUsd('');

      startPricePoller(newTrade);
      startCountdown(newTrade, () => settleTrade('expired'));
    } catch (err: any) {
      Alert.alert('Trade Failed', err.response?.data?.detail ?? 'Something went wrong. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={T.gold} />
      </View>
    );
  }

  if (assets.length === 0) return <EmptyState />;

  const priceStr = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 6 : 2 });

  return (
    <SafeAreaView style={st.container}>
      {/* Asset strip (Disabled if trade is open) */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={[st.strip, openTrade && { opacity: 0.5 }]} contentContainerStyle={st.stripContent}
        scrollEnabled={!openTrade}
      >
        {assets.map(a => {
          const active = a.symbol === activeAsset?.symbol;
          return (
            <TouchableOpacity
              key={a.symbol}
              style={[st.chip, active && { borderColor: coinColor(a.symbol), backgroundColor: coinColor(a.symbol) + '20' }]}
              onPress={() => !openTrade && setSelectedSymbol(a.symbol)}
              disabled={!!openTrade}
            >
              <CoinIcon symbol={a.symbol} size={22} />
              <View style={{ marginLeft: 8 }}>
                <Text style={[st.chipSym, active && { color: '#fff' }]}>{a.symbol}</Text>
                <Text style={[st.chipPrice, active && { color: 'rgba(255,255,255,0.7)' }]}>
                  {priceStr(a.current_price)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Chart is ALWAYS visible now */}
      <View style={st.chart}>
        {activeAsset && <TradingChart symbol={activeAsset.symbol} />}
      </View>

      {/* Dynamic Execution Panel */}
      <View style={st.panel}>
        
        {openTrade ? (
          /* ================= LIVE ACTIVE TRADE PANEL ================= */
          <View style={inline.container}>
            <View style={inline.header}>
              <View style={[inline.dirBadge, { backgroundColor: openTrade.trade_type === 'BUY' ? T.greenDim : T.redDim }]}>
                <Text style={[inline.dirText, { color: openTrade.trade_type === 'BUY' ? T.green : T.red }]}>
                  {openTrade.trade_type === 'BUY' ? 'LONG' : 'SHORT'} {openTrade.symbol}
                </Text>
              </View>
              <View style={inline.timerWrap}>
                <Text style={inline.timer}>{timeLeft}</Text>
              </View>
            </View>

            <View style={inline.pnlCenter}>
              <Text style={inline.pnlLabel}>LIVE PROFIT / LOSS ({LEVERAGE}x)</Text>
              <Animated.Text style={[inline.pnlBig, { color: livePnl >= 0 ? T.green : T.red, transform: [{ scale: pulseAnim }] }]}>
                {livePnl >= 0 ? '+' : ''}${livePnl.toFixed(2)}
              </Animated.Text>
            </View>

            <View style={inline.grid}>
              <View style={inline.gridCell}>
                <Text style={inline.cellLabel}>Entry</Text>
                <Text style={inline.cellVal}>${openTrade.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={inline.gridCell}>
                <Text style={inline.cellLabel}>Live</Text>
                <Text style={[inline.cellVal, { color: T.gold }]}>${livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[inline.gridCell, { borderBottomWidth: 0 }]}>
                <Text style={inline.cellLabel}>Invested</Text>
                <Text style={inline.cellVal}>${openTrade.amount_usd.toFixed(2)}</Text>
              </View>
              <View style={[inline.gridCell, { borderBottomWidth: 0 }]}>
                <Text style={inline.cellLabel}>Current</Text>
                <Text style={[inline.cellVal, { color: livePnl >= 0 ? T.green : T.red }]}>${Math.max(0, openTrade.amount_usd + livePnl).toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[inline.closeBtn, { borderColor: (livePnl >= 0 ? T.green : T.red) + '55', backgroundColor: (livePnl >= 0 ? T.green : T.red) + '11' }, isProcessing && { opacity: 0.6 }]}
              onPress={() => settleTrade('manual')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={livePnl >= 0 ? T.green : T.red} />
              ) : (
                <Text style={[inline.closeBtnText, { color: livePnl >= 0 ? T.green : T.red }]}>
                  Close & Settle {livePnl >= 0 ? 'Profit' : 'Loss'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* ================= STANDARD SETUP PANEL ================= */
          <>
            {activeAsset && (
              <View style={st.ticker}>
                <CoinIcon symbol={activeAsset.symbol} size={32} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={st.tickerSym}>{activeAsset.symbol}/USD</Text>
                  <Text style={st.tickerPrice}>{priceStr(activeAsset.current_price)}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <View style={st.walletInfo}>
                  <Text style={st.walletLabel}>Sub-wallet</Text>
                  <Text style={st.walletVal}>{activeAsset.balance.toFixed(6)} {activeAsset.symbol}</Text>
                </View>
              </View>
            )}

            <View style={st.divider} />

            <Text style={st.fieldLabel}>DURATION</Text>
            <View style={st.durationRow}>
              {TIMEFRAMES.map(tf => (
                <TouchableOpacity key={tf.mins} style={[st.durBtn, duration.mins === tf.mins && st.durBtnActive]} onPress={() => setDuration(tf)}>
                  <Text style={[st.durText, duration.mins === tf.mins && st.durTextActive]}>{tf.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.fieldLabel, { marginTop: 16 }]}>WAGER (USD)</Text>
            <View style={st.inputRow}>
              <Text style={st.inputPrefix}>$</Text>
              <TextInput
                style={st.input}
                placeholder="0.00"
                placeholderTextColor={T.muted}
                keyboardType="decimal-pad"
                value={amountUsd}
                onChangeText={setAmountUsd}
              />
              {activeAsset && parseFloat(amountUsd) > 0 && (
                <Text style={st.cryptoHint}>
                  ≈ {(parseFloat(amountUsd) / activeAsset.current_price).toFixed(6)} {activeAsset.symbol}
                </Text>
              )}
            </View>

            <View style={st.tradeRow}>
              <TouchableOpacity style={[st.tradeBtn, st.sellBtn, isProcessing && { opacity: 0.5 }]} onPress={() => handleStartTrade('SELL')} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.tradeBtnMain}>SELL (Short)</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[st.tradeBtn, st.buyBtn, isProcessing && { opacity: 0.5 }]} onPress={() => handleStartTrade('BUY')} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.tradeBtnMain}>BUY (Long)</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center:    { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },

  emptyContainer: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: T.text, fontSize: 22, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  emptySub:   { color: T.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  goBtn:      { backgroundColor: T.gold, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24 },
  goBtnText:  { color: '#080C14', fontWeight: '800', fontSize: 15 },

  strip:        { borderBottomWidth: 1, borderBottomColor: T.border, maxHeight: 68 },
  stripContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: T.card, borderWidth: 1.5, borderColor: T.border },
  chipSym:   { color: T.sub, fontWeight: '800', fontSize: 13 },
  chipPrice: { color: T.muted, fontSize: 10, marginTop: 1 },

  chart: { flex: 1, minHeight: 200, backgroundColor: T.bg },

  panel:      { backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, padding: 18, paddingBottom: Platform.OS === 'ios' ? 24 : 18 },
  ticker:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tickerSym:  { color: T.sub, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  tickerPrice:{ color: T.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  walletInfo: { alignItems: 'flex-end' },
  walletLabel:{ color: T.muted, fontSize: 10, letterSpacing: 0.5 },
  walletVal:  { color: T.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  divider:    { height: 1, backgroundColor: T.border, marginBottom: 14 },

  fieldLabel: { color: T.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  durationRow:{ flexDirection: 'row', gap: 6, marginBottom: 4 },
  durBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  durBtnActive:{ backgroundColor: T.goldDim, borderColor: T.gold },
  durText:    { color: T.muted, fontWeight: '700', fontSize: 12 },
  durTextActive:{ color: T.gold },

  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, height: 58, marginBottom: 14 },
  inputPrefix:{ color: T.gold, fontSize: 24, fontWeight: '900', marginRight: 8 },
  input:      { flex: 1, color: T.text, fontSize: 24, fontWeight: '900' },
  cryptoHint: { color: T.muted, fontSize: 10 },

  tradeRow: { flexDirection: 'row', gap: 10 },
  tradeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },
  sellBtn:      { backgroundColor: T.red },
  buyBtn:       { backgroundColor: T.green },
  tradeBtnMain: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

// ─── Inline Panel Styles ───────────────────────────────────────────────────────
const inline = StyleSheet.create({
  container:   { paddingTop: 4 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dirBadge:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  dirText:     { fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  timerWrap:   { backgroundColor: T.goldDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  timer:       { color: T.gold, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  pnlCenter:   { alignItems: 'center', marginBottom: 20 },
  pnlLabel:    { color: T.muted, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 6 },
  pnlBig:      { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: T.bg, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  gridCell:    { width: '50%', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  cellLabel:   { color: T.muted, fontSize: 11, marginBottom: 4 },
  cellVal:     { color: T.text, fontSize: 14, fontWeight: '800' },
  closeBtn:    { paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  closeBtnText:{ fontWeight: '800', fontSize: 15 },
});
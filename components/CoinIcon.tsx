/**
 * CoinIcon.tsx
 * Hand-drawn SVG coin logos — no image files, no third-party icon sets.
 * Each icon uses the coin's canonical colours and geometric identity.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path, Circle, G, Polygon, Rect, Ellipse, Line, Defs,
  LinearGradient, Stop, ClipPath,
} from 'react-native-svg';

interface CoinIconProps {
  symbol: string;
  size?: number;
  style?: object;
}

// ─── Bitcoin ──────────────────────────────────────────────────────────────────
const BTC = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#F7931A" />
    <Path
      fill="#fff"
      d="M22.3 13.8c.3-2.1-1.3-3.2-3.4-4l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.7-1.7-.4-.7 2.7c-.3-.1-.7-.2-1-.2l0 0-2.3-.6-.5 1.8s1.3.3 1.3.3c.7.2.9.6.8 1l-1.1 4.5c-.1.2-.4.5-.8.3.1 0-1.3-.3-1.3-.3l-.9 1.9 2.2.5c.4.1.8.2 1.2.3L11 21.7l1.7.4.7-2.8c.5.1 1 .3 1.4.4l-.7 2.7 1.7.4.7-2.8c2.9.5 5 .3 5.9-2.3.7-2-.1-3.2-1.5-3.9 1-.3 1.7-1.1 2-2.4l0 0M18.6 20.3c-.5 2.1-4.1.9-5.2.7l.9-3.7c1.1.3 4.8.8 4.3 3M19.1 13.7c-.5 1.9-3.4.9-4.4.7l.8-3.2c1 .3 4.2.8 3.6 2.5"
    />
  </Svg>
);

// ─── Ethereum ─────────────────────────────────────────────────────────────────
const ETH = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#627EEA" />
    <Path fill="rgba(255,255,255,0.6)" d="M16 5.5 L16 13.3 L22.5 16.1 Z" />
    <Path fill="#fff" d="M16 5.5 L9.5 16.1 L16 13.3 Z" />
    <Path fill="rgba(255,255,255,0.6)" d="M16 17.9 L16 26.5 L22.5 17.4 Z" />
    <Path fill="#fff" d="M16 26.5 L16 17.9 L9.5 17.4 Z" />
    <Path fill="rgba(255,255,255,0.2)" d="M16 13.3 L22.5 16.1 L16 17.9 L9.5 16.1 Z" />
  </Svg>
);

// ─── Solana ───────────────────────────────────────────────────────────────────
const SOL = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#9945FF" />
    <G>
      {/* Top bar */}
      <Path fill="#fff" d="M8 10.5 L21.5 10.5 L24 13 L10.5 13 Z" />
      {/* Middle bar */}
      <Path fill="rgba(255,255,255,0.7)" d="M8 15 L21.5 15 L24 17.5 L10.5 17.5 Z" />
      {/* Bottom bar */}
      <Path fill="#fff" d="M10.5 19.5 L24 19.5 L21.5 22 L8 22 Z" />
    </G>
  </Svg>
);

// ─── BNB ──────────────────────────────────────────────────────────────────────
const BNB = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#F3BA2F" />
    {/* BNB diamond logo */}
    <G fill="#fff">
      {/* Center diamond */}
      <Path d="M16 10.5 L18.5 13 L16 15.5 L13.5 13 Z" />
      {/* Top */}
      <Path d="M16 6.5 L18.5 9 L16 11.5 L13.5 9 Z" />
      {/* Bottom */}
      <Path d="M16 20.5 L18.5 23 L16 25.5 L13.5 23 Z" />
      {/* Left */}
      <Path d="M9.5 13.5 L12 11 L14.5 13.5 L12 16 Z" />
      {/* Right */}
      <Path d="M22.5 13.5 L25 11 L22.5 8.5 L20 11 Z" opacity="0" />
      <Path d="M17.5 13.5 L20 11 L22.5 13.5 L20 16 Z" />
    </G>
  </Svg>
);

// ─── XRP ──────────────────────────────────────────────────────────────────────
const XRP = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#00AAE4" />
    {/* XRP X logo — two converging lines */}
    <G stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
      <Line x1="9" y1="8" x2="23" y2="24" />
      <Line x1="23" y1="8" x2="9" y2="24" />
    </G>
    {/* Top arc */}
    <Path fill="none" stroke="#fff" strokeWidth="2" d="M9 8 Q16 4 23 8" />
    {/* Bottom arc */}
    <Path fill="none" stroke="#fff" strokeWidth="2" d="M9 24 Q16 28 23 24" />
  </Svg>
);

// ─── ADA (Cardano) ────────────────────────────────────────────────────────────
const ADA = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#0033AD" />
    {/* Cardano — cluster of dots in elliptical orbits */}
    <G fill="#fff">
      <Circle cx="16" cy="9" r="1.8" />
      <Circle cx="16" cy="23" r="1.8" />
      <Circle cx="9.5" cy="12.5" r="1.4" />
      <Circle cx="22.5" cy="12.5" r="1.4" />
      <Circle cx="9.5" cy="19.5" r="1.4" />
      <Circle cx="22.5" cy="19.5" r="1.4" />
      <Circle cx="16" cy="16" r="2.2" />
    </G>
  </Svg>
);

// ─── DOGE ─────────────────────────────────────────────────────────────────────
const DOGE = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#C3A634" />
    {/* D shape */}
    <Path
      fill="#fff"
      d="M11 9 L16 9 Q23 9 23 16 Q23 23 16 23 L11 23 Z M14 12 L14 20 L16 20 Q19.5 20 19.5 16 Q19.5 12 16 12 Z"
    />
    {/* Horizontal line through middle */}
    <Rect x="10.5" y="15" width="9" height="2" fill="#C3A634" />
    <Rect x="13" y="15" width="7" height="1.5" fill="rgba(195,166,52,0.6)" />
  </Svg>
);

// ─── AVAX ─────────────────────────────────────────────────────────────────────
const AVAX = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#E84142" />
    {/* Avalanche A — mountain/triangle with cutout */}
    <G fill="#fff">
      {/* Left mountain */}
      <Path d="M7 23 L12.5 13 L16 19 L13 23 Z" />
      {/* Right mountain (taller) */}
      <Path d="M16 9 L25 23 L20 23 L16 16 L19 23 L13 23 L16 16 Z" opacity="0" />
      {/* Combined Avalanche logo */}
      <Path d="M16 9 L25 23 L19 23 L16 17.5 L13 23 L7 23 L16 9 Z" />
      {/* Inner cutout */}
      <Path d="M14 19.5 L16 16 L18 19.5 Z" fill="#E84142" />
    </G>
  </Svg>
);

// ─── DOT (Polkadot) ───────────────────────────────────────────────────────────
const DOT = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#E6007A" />
    <G fill="#fff">
      <Ellipse cx="16" cy="9" rx="3.5" ry="3.5" />
      <Ellipse cx="16" cy="23" rx="3.5" ry="3.5" />
      <Ellipse cx="9" cy="12.5" rx="2.5" ry="2.5" />
      <Ellipse cx="23" cy="12.5" rx="2.5" ry="2.5" />
      <Ellipse cx="9" cy="19.5" rx="2.5" ry="2.5" />
      <Ellipse cx="23" cy="19.5" rx="2.5" ry="2.5" />
    </G>
  </Svg>
);

// ─── MATIC (Polygon) ──────────────────────────────────────────────────────────
const MATIC = ({ s }: { s: number }) => (
  <Svg width={s} height={s} viewBox="0 0 32 32">
    <Circle cx="16" cy="16" r="16" fill="#8247E5" />
    <Path
      fill="#fff"
      d="M20.5 13.8 L20.5 13.8 C19.9 13.4 19.1 13.4 18.5 13.8 L16.3 15.1 L14.8 16 L12.6 17.3 C12 17.7 11.2 17.7 10.6 17.3 L8.9 16.3 C8.3 15.9 7.9 15.3 7.9 14.6 L7.9 12.7 C7.9 12 8.3 11.4 8.9 11 L10.6 10 C11.2 9.6 12 9.6 12.6 10 L14.3 11 L14.8 11.3 L14.3 10.7 L12 9.3 C11.1 8.7 9.9 8.7 9 9.3 L7 10.6 C6.1 11.2 5.6 12.2 5.6 13.2 L5.6 15.8 C5.6 16.8 6.1 17.8 7 18.4 L9 19.7 C9.9 20.3 11.1 20.3 12 19.7 L14.2 18.4 L15.7 17.5 L17.9 16.2 C18.5 15.8 19.3 15.8 19.9 16.2 L21.6 17.2 C22.2 17.6 22.6 18.2 22.6 18.9 L22.6 20.8 C22.6 21.5 22.2 22.1 21.6 22.5 L19.9 23.5 C19.3 23.9 18.5 23.9 17.9 23.5 L16.2 22.5 L15.7 22.2 L16.2 22.8 L18.5 24.2 C19.4 24.8 20.6 24.8 21.5 24.2 L23.5 22.9 C24.4 22.3 24.9 21.3 24.9 20.3 L24.9 17.7 C24.9 16.7 24.4 15.7 23.5 15.1 L21.5 13.8 Z"
    />
  </Svg>
);

// ─── Generic fallback ─────────────────────────────────────────────────────────
const GenericCoin = ({ s, symbol }: { s: number; symbol: string }) => {
  const colors: Record<string, string> = {
    LINK: '#2A5ADA', UNI: '#FF007A', LTC: '#BFBBBB',
    ATOM: '#2E3148', NEAR: '#00C08B', FTM: '#1969FF',
    ALGO: '#000000', VET: '#15BDFF', SAND: '#04ADEF',
    MANA: '#FF2D55', AXS: '#0055D5', CRO: '#103F68',
  };
  const bg = colors[symbol] ?? '#1e293b';
  return (
    <Svg width={s} height={s} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="16" fill={bg} />
      <Circle cx="16" cy="16" r="12" fill="rgba(255,255,255,0.1)" />
    </Svg>
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────
export function CoinIcon({ symbol, size = 36, style }: CoinIconProps) {
  const s = size;
  const icon = (() => {
    switch (symbol.toUpperCase()) {
      case 'BTC':  return <BTC s={s} />;
      case 'ETH':  return <ETH s={s} />;
      case 'SOL':  return <SOL s={s} />;
      case 'BNB':  return <BNB s={s} />;
      case 'XRP':  return <XRP s={s} />;
      case 'ADA':  return <ADA s={s} />;
      case 'DOGE': return <DOGE s={s} />;
      case 'AVAX': return <AVAX s={s} />;
      case 'DOT':  return <DOT s={s} />;
      case 'MATIC':return <MATIC s={s} />;
      default:     return <GenericCoin s={s} symbol={symbol} />;
    }
  })();

  return (
    <View style={[{ width: s, height: s, borderRadius: s / 2, overflow: 'hidden' }, style]}>
      {icon}
    </View>
  );
}

// Coin brand colors
export const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF',
  BNB: '#F3BA2F', XRP: '#00AAE4', ADA: '#0033AD',
  DOGE: '#C3A634', AVAX: '#E84142', DOT: '#E6007A',
  MATIC: '#8247E5', LINK: '#2A5ADA', UNI: '#FF007A',
};
export const coinColor = (s: string) => COIN_COLORS[s] ?? '#3B82F6';

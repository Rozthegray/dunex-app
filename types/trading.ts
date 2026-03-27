// ============================================================
//  GLOBAL TRADING SYSTEM TYPES
//  Single source of truth for all data shapes across the app
// ============================================================

// --- WALLET ---
export interface MainWallet {
  wallet_id: string;
  cached_balance: number;
  currency: string;
}

export interface SubWallet {
  symbol: string;
  balance: number;        // amount of crypto held
  current_price: number;  // live USD price per unit
  value_usd: number;      // balance * current_price
}

export interface PortfolioData {
  usd_balance: number;
  total_value_usd: number; // usd_balance + sum of all sub-wallet USD values
  assets: SubWallet[];
}

// --- MARKET ---
export interface MarketAsset {
  symbol: string;
  name: string;
  pair: string;
  current_price: number;
  price_change_percent: number;
  high_24h: number;
  low_24h: number;
  volume: number;
  market_cap?: number;
  logo?: string; // CMC logo URL
}

// --- TRADES ---
export type TradeType = 'BUY' | 'SELL' | 'ACTIVE_START' | 'ACTIVE_CLOSE';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'completed' | 'failed';

export interface TradeExecution {
  id: string;
  pair: string;
  trade_type: TradeType;
  amount_usd: number;
  amount_crypto: number;
  entry_price: number;
  status: TradeStatus;
  created_at: string;
}

// The in-memory representation of a live active trade (not persisted until close)
export interface ActiveTrade {
  id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount_usd: number;
  crypto_wager: number;   // how much crypto was locked
  entry_price: number;
  expires_at: number;     // Date.now() + duration
}

// --- TRANSACTIONS (Wallet Ledger) ---
export type TransactionType = 'deposit' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'rejected';

export interface LedgerTransaction {
  id: string;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  reference: string;
  created_at: string;
  proof_url?: string;
}

// --- PAYMENT METHODS ---
export interface PaymentMethod {
  id: string;
  name: string;
  method_type: 'crypto' | 'bank_transfer' | 'p2p_app';
  account_details: string;
  instructions?: string;
}

// --- API REQUEST/RESPONSE HELPERS ---
export interface ExecuteTradePayload {
  symbol: string;
  amount_usd: number;
  trade_type: 'BUY' | 'SELL';
}

export interface ActiveAdjustPayload {
  symbol: string;
  amount_crypto: number; // negative = debit (open), positive = credit (close)
}

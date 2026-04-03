// ============================================================
//  GLOBAL TRADING SYSTEM TYPES (UPDATED 4-BALANCE SYSTEM)
// ============================================================

export interface WalletBalances {
  main: number;
  profit: number;
  bonus: number;
  referral: number;
}

export interface PortfolioSummary {
  total_equity: number; // main + profit + bonus + referral
  balances: WalletBalances;
}

// --- MARKET (Read-Only Ticker) ---
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
  logo?: string;
}

// --- TRANSACTIONS (Wallet Ledger) ---
export type TransactionType = 'deposit' | 'withdrawal' | 'admin_adjustment';
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
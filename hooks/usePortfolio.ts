// ============================================================
//  usePortfolio — Loads and caches the 4-Balance Ledger
// ============================================================
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { apiClient } from '../lib/apiClient';
import type { PortfolioSummary } from '../types/trading';

const EMPTY_PORTFOLIO: PortfolioSummary = {
  total_equity: 0,
  balances: { main: 0, profit: 0, bonus: 0, referral: 0 }
};

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(EMPTY_PORTFOLIO);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchPortfolio = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      // Backend should return { total_equity, balances: { main, profit, bonus, referral } }
      const res = await apiClient.get<PortfolioSummary>('/wallet/summary');
      if (!isMountedRef.current) return;
      
      setPortfolio(res.data);
      setError(null);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err.response?.data?.detail ?? 'Failed to load balances.');
    } finally {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchPortfolio();
      return () => { isMountedRef.current = false; };
    }, [fetchPortfolio])
  );

  const refresh = useCallback(() => fetchPortfolio(true), [fetchPortfolio]);

  return { portfolio, isLoading, isRefreshing, error, refresh };
}
// ============================================================
//  usePortfolio — loads and caches wallet + sub-wallet data
//  Provides helpers for buy/sell/convert actions
// ============================================================
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { apiClient } from '../lib/apiClient';
import type { PortfolioData, ExecuteTradePayload, ActiveAdjustPayload } from '../types/trading';

interface UsePortfolioReturn {
  portfolio: PortfolioData;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
  executeTrade: (payload: ExecuteTradePayload) => Promise<void>;
  activeAdjust: (payload: ActiveAdjustPayload) => Promise<{ new_balance: number }>;
}

const EMPTY_PORTFOLIO: PortfolioData = {
  usd_balance: 0,
  total_value_usd: 0,
  assets: [],
};

export function usePortfolio(): UsePortfolioReturn {
  const [portfolio, setPortfolio] = useState<PortfolioData>(EMPTY_PORTFOLIO);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchPortfolio = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await apiClient.get<PortfolioData>('/trade/portfolio');
      if (!isMountedRef.current) return;
      // Compute total_value_usd server might not send it
      const assetTotal = res.data.assets.reduce((sum, a) => sum + a.value_usd, 0);
      setPortfolio({ ...res.data, total_value_usd: res.data.usd_balance + assetTotal });
      setError(null);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err.response?.data?.detail ?? 'Failed to load portfolio.');
    } finally {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchPortfolio();
      return () => { isMountedRef.current = false; };
    }, [fetchPortfolio])
  );

  const refresh = useCallback(() => fetchPortfolio(true), [fetchPortfolio]);

  const executeTrade = useCallback(async (payload: ExecuteTradePayload) => {
    await apiClient.post('/trade/execute', payload);
    await fetchPortfolio(); // Always refresh after trade
  }, [fetchPortfolio]);

  const activeAdjust = useCallback(async (payload: ActiveAdjustPayload) => {
    const res = await apiClient.post<{ new_balance: number }>('/trade/active/adjust', payload);
    await fetchPortfolio();
    return res.data;
  }, [fetchPortfolio]);

  return { portfolio, isLoading, isRefreshing, error, refresh, executeTrade, activeAdjust };
}

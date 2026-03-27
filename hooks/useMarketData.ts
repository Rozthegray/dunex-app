// ============================================================
//  useMarketData — polls /trade/market every 10 seconds
//  Returns live prices, loading state, and last-updated time
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';
import type { MarketAsset } from '../types/trading';

const POLL_INTERVAL_MS = 10_000;

interface UseMarketDataReturn {
  assets: MarketAsset[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  getAsset: (symbol: string) => MarketAsset | undefined;
}

export function useMarketData(): UseMarketDataReturn {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchMarket = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await apiClient.get<MarketAsset[]>('/trade/market');
      if (!isMountedRef.current) return;
      setAssets(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err.response?.data?.detail ?? 'Failed to load market data.');
    } finally {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchMarket();
    intervalRef.current = setInterval(() => fetchMarket(), POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMarket]);

  const refresh = useCallback(() => fetchMarket(true), [fetchMarket]);

  const getAsset = useCallback(
    (symbol: string) => assets.find(a => a.symbol === symbol),
    [assets]
  );

  return { assets, isLoading, isRefreshing, error, lastUpdated, refresh, getAsset };
}

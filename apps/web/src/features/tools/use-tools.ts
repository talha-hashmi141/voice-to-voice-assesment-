'use client';

import { useCallback, useEffect } from 'react';
import { hrApi, toolsApi } from '@/lib/api';
import { useApi } from '@/lib/hooks';

const REFRESH_MS = 8_000;

/** Polls while the page is open so a ticket created by voice in another tab shows up here. */
function usePolling(reload: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload, enabled]);
}

export function useToolCatalog() {
  const loader = useCallback(() => toolsApi.list(), []);
  return useApi(loader);
}

export function useToolUsage() {
  const loader = useCallback(() => toolsApi.usage(), []);
  const state = useApi(loader);
  usePolling(state.reload);
  return state;
}

export function useTickets() {
  const loader = useCallback(() => hrApi.tickets(), []);
  const state = useApi(loader);
  usePolling(state.reload);
  return state;
}

export function useEmployees() {
  const loader = useCallback(() => hrApi.employees(), []);
  return useApi(loader);
}

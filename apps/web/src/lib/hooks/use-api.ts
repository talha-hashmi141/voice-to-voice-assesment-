'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../api-client';

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  version: number;
  data: T | null;
  error: string | null;
}

/**
 * Small data-loading hook: pass a memoised loader; re-runs when it changes or on reload().
 * `loading` is derived (requested version ≠ settled version) so no state is set synchronously
 * inside the effect; previous data stays visible while a reload is in flight.
 */
export function useApi<T>(loader: () => Promise<T>): ApiState<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ version: -1, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((result) => {
        if (!cancelled) setSettled({ version, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSettled((previous) => ({
            version,
            data: previous.data,
            error: err instanceof ApiClientError ? err.message : 'Could not reach the API',
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: settled.data, error: settled.error, loading: settled.version !== version, reload };
}

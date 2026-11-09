'use client';

import type { RetrievalMode, SearchResponse } from '@voice-agent/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { knowledgeApi } from '@/lib/api';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/hooks';

export function useDocuments() {
  const loader = useCallback(() => knowledgeApi.listDocuments(), []);
  return useApi(loader);
}

export function useSearch() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, mode: RetrievalMode, topK = 5) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await knowledgeApi.search({ query, mode, topK }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, search };
}

/** Triggers a reindex and polls job status until every job has finished. */
export function useReindex(onDone: () => void) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const start = useCallback(
    async (force: boolean) => {
      setRunning(true);
      try {
        const { jobs } = await knowledgeApi.reindex(force);
        const ids = new Set(jobs.map((job) => job.id));
        setProgress({ done: 0, total: ids.size });
        const poll = async () => {
          const { jobs: latest } = await knowledgeApi.listJobs();
          const mine = latest.filter((job) => ids.has(job.id));
          const done = mine.filter(
            (job) => job.status === 'completed' || job.status === 'failed',
          ).length;
          setProgress({ done, total: ids.size });
          if (done < ids.size) {
            timer.current = setTimeout(poll, 700);
            return;
          }
          const failed = mine.filter((job) => job.status === 'failed');
          if (failed.length) toast.error(`${failed.length} document(s) failed to index`);
          else toast.success(`Indexed ${ids.size} document(s)`);
          setRunning(false);
          onDone();
        };
        await poll();
      } catch (err) {
        toast.error(err instanceof ApiClientError ? err.message : 'Reindex failed');
        setRunning(false);
      }
    },
    [onDone],
  );

  return { running, progress, start };
}

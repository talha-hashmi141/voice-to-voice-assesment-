'use client';

import type { RetrievalMode, SearchResponse } from '@voice-agent/contracts';
import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { ScoreBar } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const MODES: { value: RetrievalMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'Dense + keyword, fused with reciprocal rank fusion' },
  { value: 'dense', label: 'Dense', hint: 'Embedding similarity only' },
  { value: 'sparse', label: 'Keyword', hint: 'Postgres full-text search only' },
];

const SAMPLE_QUERIES = [
  'How long do I have to claim back money I spent on a business trip?',
  'What happens to my unused vacation at the end of the year?',
  'Someone stole my phone, who do I tell?',
  'Can I work from Portugal for a month?',
];

export interface SearchPlaygroundProps {
  result: SearchResponse | null;
  loading: boolean;
  error: string | null;
  onSearch: (query: string, mode: RetrievalMode) => void;
  onOpenDocument: (documentId: string) => void;
}

/** Semantic search playground: ranked passages with fused and per-channel scores. */
export function SearchPlayground({ result, loading, error, onSearch, onOpenDocument }: SearchPlaygroundProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');

  const run = (q = query, m = mode) => {
    if (!q.trim()) return;
    setQuery(q);
    setMode(m);
    onSearch(q, m);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask in your own words…" aria-label="Search query" />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
            Search
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Retrieval mode">
            {MODES.map((m) => (
              <Button key={m.value} type="button" size="xs" variant={mode === m.value ? 'secondary' : 'ghost'} role="radio" aria-checked={mode === m.value} title={m.hint} onClick={() => run(query, m.value)}>
                {m.label}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Try:</span>
          {SAMPLE_QUERIES.map((sample) => (
            <Button key={sample} type="button" size="xs" variant="outline" className="max-w-64 truncate font-normal" onClick={() => run(sample, mode)}>
              {sample}
            </Button>
          ))}
        </div>
      </form>

      {error ? <p className="text-sm text-state-error">{error}</p> : null}

      {result ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {result.hits.length} passages · {result.mode} · {result.tookMs} ms
          </p>
          {result.hits.map((hit) => (
            <article key={hit.chunkId} className="rounded-lg border bg-card p-3 text-sm">
              <header className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  #{hit.rank}
                </Badge>
                <button type="button" onClick={() => onOpenDocument(hit.documentId)} className="font-medium hover:underline">
                  {hit.documentTitle}
                </button>
                <span className="text-xs text-muted-foreground">› {hit.sectionPath}</span>
              </header>
              <p className="mb-3 line-clamp-4 whitespace-pre-wrap text-foreground/90">{hit.content}</p>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-3">
                <ScoreBar label="fused" value={hit.scores.fused} />
                <ScoreBar label="dense" value={hit.scores.dense} />
                <ScoreBar label="keyword" value={hit.scores.sparse} />
              </div>
            </article>
          ))}
          {!result.hits.length ? <p className="text-sm text-muted-foreground">No passages matched.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

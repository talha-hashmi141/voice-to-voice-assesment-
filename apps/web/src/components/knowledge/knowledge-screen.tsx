'use client';

import type { DocumentDetail } from '@voice-agent/contracts';
import { RefreshCwIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDocuments, useReindex, useSearch } from '@/features/knowledge';
import { knowledgeApi } from '@/lib/api';
import { DocumentList } from './document-list';
import { DocumentViewer } from './document-viewer';
import { SearchPlayground } from './search-playground';

export function KnowledgeScreen() {
  const documents = useDocuments();
  const search = useSearch();
  const reindex = useReindex(documents.reload);
  const [viewer, setViewer] = useState<{ id: string; detail: DocumentDetail | null; loading: boolean } | null>(null);

  const openDocument = useCallback(async (id: string) => {
    setViewer({ id, detail: null, loading: true });
    try {
      const detail = await knowledgeApi.getDocument(id);
      setViewer({ id, detail, loading: false });
    } catch {
      setViewer(null);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Knowledge base"
        description="Twelve Orbital Labs policy documents, chunked by section and indexed for hybrid semantic search."
        actions={
          <Button size="sm" variant="outline" disabled={reindex.running} onClick={() => void reindex.start(true)}>
            {reindex.running ? <Spinner className="size-3.5" /> : <RefreshCwIcon className="size-3.5" />}
            {reindex.running && reindex.progress ? `Indexing ${reindex.progress.done}/${reindex.progress.total}` : 'Reindex all'}
          </Button>
        }
      />
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-4 md:grid-cols-[18rem_1fr] md:px-6">
        <aside>
          {documents.error ? <p className="text-sm text-state-error">{documents.error}</p> : null}
          <DocumentList documents={documents.data?.documents ?? []} loading={documents.loading} selectedId={viewer?.id ?? null} onSelect={(doc) => void openDocument(doc.id)} />
        </aside>
        <section>
          <SearchPlayground result={search.result} loading={search.loading} error={search.error} onSearch={(q, mode) => void search.search(q, mode)} onOpenDocument={(id) => void openDocument(id)} />
        </section>
      </div>
      <DocumentViewer document={viewer?.detail ?? null} loading={viewer?.loading ?? false} open={!!viewer} onOpenChange={(open) => !open && setViewer(null)} />
    </div>
  );
}

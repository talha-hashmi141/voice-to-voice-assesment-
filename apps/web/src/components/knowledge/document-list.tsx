'use client';

import type { DocumentSummary } from '@voice-agent/contracts';
import { FileTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function DocumentList({
  documents,
  loading,
  selectedId,
  onSelect,
}: {
  documents: DocumentSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (doc: DocumentSummary) => void;
}) {
  if (loading && !documents.length) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  const categories = Array.from(new Set(documents.map((d) => d.category)));
  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {category.replace('-', ' ')}
          </h3>
          <ul className="flex flex-col gap-1">
            {documents
              .filter((d) => d.category === category)
              .map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(doc)}
                    aria-current={selectedId === doc.id ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                      selectedId === doc.id
                        ? 'border-primary/60 bg-muted/60'
                        : 'border-transparent',
                    )}
                  >
                    <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{doc.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        <span>
                          {doc.chunkCount} chunks · {doc.tokenCount.toLocaleString()} tokens
                        </span>
                        {doc.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-4 px-1 text-[10px] font-normal"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

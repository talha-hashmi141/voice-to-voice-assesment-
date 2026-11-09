'use client';

import type { DocumentDetail } from '@voice-agent/contracts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

export function DocumentViewer({ document, loading, open, onOpenChange }: { document: DocumentDetail | null; loading: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{document?.title ?? 'Document'}</SheetTitle>
          <SheetDescription>
            {document ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{document.category}</Badge>
                <span>
                  {document.chunkCount} chunks · {document.sections.length} sections
                </span>
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          {loading || !document ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert [&_h1]:text-lg [&_h2]:mt-5 [&_h2]:text-base [&_table]:text-xs [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

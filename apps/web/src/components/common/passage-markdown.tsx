'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Renders a knowledge-base passage (markdown fragment) compactly: tables, lists and emphasis kept readable. */
export function PassageMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-foreground/90 dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-1 prose-table:text-xs prose-th:px-1.5 prose-th:py-0.5 prose-td:px-1.5 prose-td:py-0.5 prose-headings:my-1 prose-headings:text-sm',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

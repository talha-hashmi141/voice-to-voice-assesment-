import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Knowledge base' };

export default function KnowledgePage() {
  return (
    <section className="flex flex-1 flex-col p-6">
      <h1 className="text-lg font-semibold">Knowledge base</h1>
      <p className="text-sm text-muted-foreground">Documents and semantic search playground.</p>
    </section>
  );
}

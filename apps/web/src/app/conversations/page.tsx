import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Conversations' };

export default function ConversationsPage() {
  return (
    <section className="flex flex-1 flex-col p-6">
      <h1 className="text-lg font-semibold">Conversations</h1>
      <p className="text-sm text-muted-foreground">History of past voice sessions.</p>
    </section>
  );
}

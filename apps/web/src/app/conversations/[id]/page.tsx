import type { Metadata } from 'next';
import { ConversationDetail } from '@/components/conversations';

export const metadata: Metadata = { title: 'Conversation' };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationDetail id={id} />;
}

import type { Metadata } from 'next';
import { ConversationsScreen } from '@/components/conversations';

export const metadata: Metadata = { title: 'Conversations' };

export default function ConversationsPage() {
  return <ConversationsScreen />;
}

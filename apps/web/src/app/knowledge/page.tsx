import type { Metadata } from 'next';
import { KnowledgeScreen } from '@/components/knowledge';

export const metadata: Metadata = { title: 'Knowledge base' };

export default function KnowledgePage() {
  return <KnowledgeScreen />;
}

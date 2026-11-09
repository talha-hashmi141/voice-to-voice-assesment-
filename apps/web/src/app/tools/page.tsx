import type { Metadata } from 'next';
import { ToolsScreen } from '@/components/tools';

export const metadata: Metadata = { title: 'Tools & tickets' };

export default function ToolsPage() {
  return <ToolsScreen />;
}

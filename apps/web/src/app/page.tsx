import { Suspense } from 'react';
import { VoiceAgentScreen } from '@/components/voice';

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { conversation } = await searchParams;
  return (
    <Suspense>
      <VoiceAgentScreen conversationId={conversation} />
    </Suspense>
  );
}

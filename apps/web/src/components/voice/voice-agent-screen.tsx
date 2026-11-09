'use client';

import type { Source } from '@voice-agent/contracts';
import { ActivityIcon, EarIcon, HandIcon, RotateCcwIcon, SendIcon, SquareIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVoiceSession } from '@/features/voice-session';
import { cn } from '@/lib/utils';
import { SourcesSheet, TranscriptList } from '../transcript';
import { AgentTracePanel } from '../trace';
import { PersonaSelect } from './persona-select';
import { VoiceOrb } from './voice-orb';

const CONNECTION_STYLES: Record<string, string> = {
  connected: 'bg-state-listening/15 text-state-listening',
  connecting: 'bg-state-processing/20 text-state-processing',
  disconnected: 'bg-muted text-muted-foreground',
  error: 'bg-state-error/15 text-state-error',
};

export function VoiceAgentScreen({ conversationId }: { conversationId?: string }) {
  const session = useVoiceSession({ conversationId });
  const [draft, setDraft] = useState('');
  const [sources, setSources] = useState<{ list: Source[]; focus: number | null } | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  const openSource = (source: Source) => {
    const owner = [...session.messages]
      .reverse()
      .find((m) => m.sources.some((s) => s.chunkId === source.chunkId));
    setSources({ list: owner?.sources ?? [source], focus: source.index });
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    session.sendText(draft);
    setDraft('');
  };

  const busy = session.phase !== 'idle' && session.phase !== 'listening';

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col md:h-dvh">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 md:px-6">
        <div className="mr-auto flex items-center gap-2">
          <h1 className="text-sm font-semibold">Voice agent</h1>
          <Badge
            variant="outline"
            className={cn('h-5 capitalize', CONNECTION_STYLES[session.connection])}
          >
            {session.connection}
          </Badge>
          {session.provider ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant="secondary" className="h-5 font-mono text-[10px] uppercase" />
                }
              >
                {session.provider}
              </TooltipTrigger>
              <TooltipContent>
                {session.provider === 'mock'
                  ? 'Mock providers: no API key configured. Speech is replayed from demo phrases; use the text box for free-form questions.'
                  : 'OpenAI providers: real transcription, reasoning and speech.'}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <PersonaSelect
          value={session.persona}
          onChange={(p) => void session.changePersona(p)}
          disabled={busy}
        />
        <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Input mode">
          {(
            [
              ['handsfree', EarIcon, 'Hands-free'],
              ['push', HandIcon, 'Push to talk'],
            ] as const
          ).map(([mode, Icon, label]) => (
            <Button
              key={mode}
              size="sm"
              variant={session.mode === mode ? 'secondary' : 'ghost'}
              role="radio"
              aria-checked={session.mode === mode}
              onClick={() => {
                if (session.micActive) void session.stopListening();
                session.setMode(mode);
              }}
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={session.reset} aria-label="Reset conversation">
          <RotateCcwIcon className="size-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="lg:hidden"
          onClick={() => setTraceOpen(true)}
          aria-label="Show agent trace"
        >
          <ActivityIcon className="size-3.5" />
          Trace
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TranscriptList
              messages={session.messages}
              streamingText={session.streaming?.text ?? null}
              onCite={openSource}
            />
          </div>
          <div className="border-t bg-background/80 px-4 pt-4 pb-3 backdrop-blur md:px-6">
            {session.error ? (
              <p className="mb-2 text-center text-xs text-state-error">{session.error}</p>
            ) : null}
            <div className="flex items-center justify-center gap-6">
              <VoiceOrb
                phase={session.phase}
                micActive={session.micActive}
                level={session.micLevel}
                mode={session.mode}
                disabled={session.connection !== 'connected' || !session.mic.supported}
                onToggle={() => void session.toggleListening()}
                onPressStart={() => void session.startListening()}
                onPressEnd={() => void session.stopListening()}
              />
              {busy ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={session.interrupt}
                  aria-label="Stop the current answer"
                >
                  <SquareIcon className="size-3.5" />
                  Stop
                </Button>
              ) : null}
            </div>
            <form onSubmit={submitDraft} className="mx-auto mt-3 flex max-w-2xl items-center gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Or type a question…"
                aria-label="Type a question"
                disabled={session.connection !== 'connected'}
              />
              <Button
                type="submit"
                size="icon"
                variant="outline"
                disabled={!draft.trim() || session.connection !== 'connected'}
                aria-label="Send"
              >
                <SendIcon className="size-4" />
              </Button>
            </form>
            {!session.mic.supported ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Microphone access is not available in this browser; use the text box.
              </p>
            ) : null}
          </div>
        </section>
        <aside className="hidden w-[360px] shrink-0 border-l lg:block">
          <AgentTracePanel
            trace={session.trace}
            metrics={session.lastMetrics}
            phase={session.phase}
          />
        </aside>
      </div>

      <SourcesSheet
        sources={sources?.list ?? []}
        focusIndex={sources?.focus ?? null}
        open={!!sources}
        onOpenChange={(open) => !open && setSources(null)}
      />
      <Sheet open={traceOpen} onOpenChange={setTraceOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Agent trace</SheetTitle>
          <AgentTracePanel
            trace={session.trace}
            metrics={session.lastMetrics}
            phase={session.phase}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

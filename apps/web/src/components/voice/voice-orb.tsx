'use client';

import { LoaderCircleIcon, MicIcon, MicOffIcon, Volume2Icon, WrenchIcon } from 'lucide-react';
import { type SessionPhase } from '@/features/voice-session';
import { cn } from '@/lib/utils';

export interface VoiceOrbProps {
  phase: SessionPhase;
  micActive: boolean;
  level: number;
  mode: 'handsfree' | 'push';
  disabled?: boolean;
  onToggle: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
}

const LABELS: Record<SessionPhase, string> = {
  idle: 'Tap to start listening',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Thinking…',
  executing_tools: 'Using tools…',
  speaking: 'Speaking…',
};

/** The main control: a state-driven orb (idle / listening / processing / speaking). */
export function VoiceOrb({
  phase,
  micActive,
  level,
  mode,
  disabled,
  onToggle,
  onPressStart,
  onPressEnd,
}: VoiceOrbProps) {
  const processing =
    phase === 'transcribing' || phase === 'thinking' || phase === 'executing_tools';
  const speaking = phase === 'speaking';
  const listening = phase === 'listening';
  const color = listening
    ? 'bg-state-listening'
    : processing
      ? 'bg-state-processing'
      : speaking
        ? 'bg-state-speaking'
        : 'bg-foreground';
  const Icon = speaking
    ? Volume2Icon
    : phase === 'executing_tools'
      ? WrenchIcon
      : processing
        ? LoaderCircleIcon
        : micActive
          ? MicIcon
          : MicOffIcon;

  const pressHandlers =
    mode === 'push'
      ? {
          onPointerDown: (event: React.PointerEvent) => {
            event.preventDefault();
            onPressStart();
          },
          onPointerUp: onPressEnd,
          onPointerLeave: onPressEnd,
          onPointerCancel: onPressEnd,
        }
      : { onClick: onToggle };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex size-36 items-center justify-center">
        {listening ? (
          <>
            <span
              className={cn('absolute inset-4 rounded-full opacity-40', color)}
              style={{
                transform: `scale(${1 + level * 0.6})`,
                transition: 'transform 80ms linear',
              }}
            />
            <span className={cn('orb-ring-pulse absolute inset-6 rounded-full', color)} />
          </>
        ) : null}
        {processing ? (
          <span className="orb-ring-spin absolute inset-3 rounded-full border-4 border-state-processing/20 border-t-state-processing" />
        ) : null}
        {speaking ? (
          <span className="absolute inset-0 flex items-center justify-center gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="orb-bar h-16 w-1.5 rounded-full bg-state-speaking/50"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </span>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={micActive}
          aria-label={
            mode === 'push' ? 'Hold to talk' : micActive ? 'Stop listening' : 'Start listening'
          }
          className={cn(
            'relative z-10 flex size-24 items-center justify-center rounded-full text-background shadow-lg transition-all select-none focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50',
            color,
            micActive && mode === 'push' && 'scale-95',
          )}
          {...pressHandlers}
        >
          <Icon
            className={cn(
              'size-9',
              processing && !speaking && phase !== 'executing_tools' && 'animate-spin',
            )}
          />
        </button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {mode === 'push' && (phase === 'idle' || phase === 'listening')
          ? micActive
            ? 'Release to send'
            : 'Hold to talk'
          : LABELS[phase]}
      </p>
    </div>
  );
}

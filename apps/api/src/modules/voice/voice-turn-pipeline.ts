import { Inject, Injectable, Logger } from '@nestjs/common';
import { type TurnMetrics, type UserContext } from '@voice-agent/contracts';
import { AppConfigService, Stopwatch } from '../../common';
import { AgentRuntime, type AgentTurnResult } from '../agent';
import { estimateSttCost, estimateTtsCost, sumCosts } from '../llm';
import { MessageRepository } from '../conversations';
import {
  DOMAIN_VOCABULARY_PROMPT,
  STT_PROVIDER,
  type SttProvider,
  TTS_PROVIDER,
  type TtsProvider,
} from '../speech';
import { AsyncQueue } from './async-queue';
import { SentenceChunker } from './sentence-chunker';
import { SpeechScheduler } from './speech-scheduler';
import { type VoiceEvent } from './voice-events';

export interface VoiceTurnInput {
  turnId: string;
  conversationId: string;
  userContext: UserContext;
  audio?: { data: Buffer; mimeType: string; durationMs?: number };
  text?: string;
  signal: AbortSignal;
}

/** Milliseconds of a 16-bit mono 16 kHz WAV from its byte length (fallback when the client sends no duration). */
const estimateWavMs = (data: Buffer): number =>
  Math.max(0, (data.byteLength - 44) / 2 / 16_000) * 1000;

const TTS_INSTRUCTIONS =
  'Speak like a friendly, efficient colleague: warm, clear, moderately paced, natural intonation.';

/**
 * One voice turn = speech-to-text → agent loop → sentence-pipelined text-to-speech.
 * Produces a single ordered event stream that the gateway relays to the client.
 */
@Injectable()
export class VoiceTurnPipeline {
  private readonly logger = new Logger(VoiceTurnPipeline.name);

  constructor(
    private readonly agent: AgentRuntime,
    @Inject(STT_PROVIDER) private readonly stt: SttProvider,
    @Inject(TTS_PROVIDER) private readonly tts: TtsProvider,
    private readonly messages: MessageRepository,
    private readonly config: AppConfigService,
  ) {}

  run(input: VoiceTurnInput): AsyncIterable<VoiceEvent> {
    const queue = new AsyncQueue<VoiceEvent>();
    void this.execute(input, queue)
      .catch((error: unknown) => {
        if (input.signal.aborted) {
          queue.push({ type: 'cancelled' });
          return;
        }
        this.logger.error(
          `Turn ${input.turnId} failed: ${error instanceof Error ? error.stack : String(error)}`,
        );
        queue.push({
          type: 'error',
          code: 'TURN_FAILED',
          message: error instanceof Error ? error.message : 'The turn failed',
          fatal: true,
        });
      })
      .finally(() => queue.close());
    return queue;
  }

  private async execute(input: VoiceTurnInput, queue: AsyncQueue<VoiceEvent>): Promise<void> {
    const stopwatch = new Stopwatch();
    let sttMs: number | null = null;
    let userText = input.text?.trim() ?? '';

    if (input.audio) {
      queue.push({ type: 'state', state: 'transcribing' });
      const transcript = await this.stt.transcribe({
        audio: input.audio.data,
        mimeType: input.audio.mimeType,
        prompt: DOMAIN_VOCABULARY_PROMPT,
        signal: input.signal,
      });
      sttMs = stopwatch.mark('stt');
      userText = transcript.text.trim();
    }
    queue.push({ type: 'transcript', text: userText, sttMs });
    if (!userText) {
      queue.push({
        type: 'error',
        code: 'EMPTY_TRANSCRIPT',
        message: "I didn't catch that. Could you say it again?",
        fatal: true,
      });
      return;
    }

    const chunker = new SentenceChunker();
    const speaker = new SpeechScheduler(this.tts, queue, {
      voice: this.config.openai.ttsVoice,
      instructions: TTS_INSTRUCTIONS,
      concurrency: 2,
      signal: input.signal,
      onFirstAudio: () => {
        stopwatch.markOnce('first_audio');
        queue.push({ type: 'state', state: 'speaking' });
      },
    });

    let result: AgentTurnResult | undefined;
    let cancelled = false;
    for await (const event of this.agent.run({
      turnId: input.turnId,
      conversationId: input.conversationId,
      userText,
      userContext: input.userContext,
      signal: input.signal,
      stopwatch,
    })) {
      switch (event.type) {
        case 'state':
          queue.push({ type: 'state', state: event.state });
          break;
        case 'text_delta':
          queue.push(event);
          for (const sentence of chunker.push(event.delta)) speaker.speak(sentence);
          break;
        case 'tool_call': {
          // Narration before a tool call is still worth speaking ("Let me check that for you").
          const rest = chunker.flush();
          if (rest) speaker.speak(rest);
          queue.push(event);
          break;
        }
        case 'tool_result':
        case 'retrieval_evaluated':
          queue.push(event);
          break;
        case 'completed':
          result = event.result;
          break;
        case 'cancelled':
          cancelled = true;
          break;
      }
    }

    const rest = chunker.flush();
    if (rest && !cancelled) speaker.speak(rest);

    if (cancelled || input.signal.aborted) {
      speaker.cancel();
      queue.push({ type: 'cancelled' });
      return;
    }
    if (!result) throw new Error('The agent produced no result');

    await speaker.drain();
    if (input.signal.aborted) {
      queue.push({ type: 'cancelled' });
      return;
    }
    const audioSeconds = input.audio
      ? (input.audio.durationMs ?? estimateWavMs(input.audio.data)) / 1000
      : 0;
    const metrics: TurnMetrics = {
      ...result.metrics,
      sttMs,
      firstAudioMs: stopwatch.get('first_audio'),
      ttsMs: speaker.firstSynthesisMs,
      totalMs: stopwatch.elapsed(),
      estimatedCostUsd: sumCosts(
        result.metrics.estimatedCostUsd,
        input.audio ? estimateSttCost(this.stt.model, audioSeconds) : null,
        estimateTtsCost(this.tts.model, speaker.spokenWords),
      ),
    };
    await this.messages.updateMetrics(result.assistantMessage.id, metrics);
    queue.push({
      type: 'completed',
      result: { ...result, metrics, assistantMessage: { ...result.assistantMessage, metrics } },
    });
  }
}

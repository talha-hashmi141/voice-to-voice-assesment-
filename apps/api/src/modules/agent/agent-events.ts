import {
  type AgentStep,
  type Message,
  type RetrievalAssessment,
  type Source,
  type TurnMetrics,
} from '@voice-agent/contracts';

export interface AgentTurnResult {
  /** Final answer with [n] citation markers (shown in the transcript). */
  text: string;
  /** Final answer without markers/markdown, ready for text-to-speech. */
  spokenText: string;
  sources: Source[];
  steps: AgentStep[];
  metrics: TurnMetrics;
  userMessage: Message;
  assistantMessage: Message;
}

export type AgentEvent =
  | { type: 'state'; state: 'thinking' | 'executing_tools' }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; callId: string; name: string; args: Record<string, unknown> }
  | {
      type: 'tool_result';
      callId: string;
      name: string;
      ok: boolean;
      summary: string;
      durationMs: number;
      data?: unknown;
    }
  | {
      type: 'retrieval_evaluated';
      callId: string;
      assessment: RetrievalAssessment;
      topScore: number | null;
      hits: number;
      queries: string[];
      reason: string;
    }
  | { type: 'cancelled'; partialText: string }
  | { type: 'completed'; result: AgentTurnResult };

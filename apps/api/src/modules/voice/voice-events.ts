import { type TurnState } from '@voice-agent/contracts';
import { type AgentEvent, type AgentTurnResult } from '../agent';

export type VoiceEvent =
  | { type: 'state'; state: TurnState }
  | { type: 'transcript'; text: string; sttMs: number | null }
  | Extract<AgentEvent, { type: 'text_delta' | 'tool_call' | 'tool_result' | 'retrieval_evaluated' }>
  | { type: 'audio'; seq: number; mimeType: string; data: Buffer; text: string }
  | { type: 'completed'; result: AgentTurnResult }
  | { type: 'cancelled' }
  | { type: 'error'; code: string; message: string; fatal: boolean };

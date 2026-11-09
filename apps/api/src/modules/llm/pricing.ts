/**
 * List prices (USD) used for per-turn cost estimates shown in the UI. They are estimates:
 * keep them current with https://openai.com/api/pricing when models change.
 */
export interface ChatPricing {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
}

export const CHAT_PRICING: Record<string, ChatPricing> = {
  'gpt-4.1': { inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, cachedInputPerMillion: 0.1, outputPerMillion: 1.6 },
  'gpt-4.1-nano': { inputPerMillion: 0.1, cachedInputPerMillion: 0.025, outputPerMillion: 0.4 },
  'gpt-4o': { inputPerMillion: 2.5, cachedInputPerMillion: 1.25, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, cachedInputPerMillion: 0.075, outputPerMillion: 0.6 },
  'gpt-5': { inputPerMillion: 1.25, cachedInputPerMillion: 0.125, outputPerMillion: 10 },
  'gpt-5-mini': { inputPerMillion: 0.25, cachedInputPerMillion: 0.025, outputPerMillion: 2 },
  'gpt-5-nano': { inputPerMillion: 0.05, cachedInputPerMillion: 0.005, outputPerMillion: 0.4 },
};

/** Per minute of audio. */
export const STT_PRICING_PER_MINUTE: Record<string, number> = {
  'gpt-4o-mini-transcribe': 0.003,
  'gpt-4o-transcribe': 0.006,
  'whisper-1': 0.006,
};

/** Per minute of generated speech (OpenAI's published estimate). */
export const TTS_PRICING_PER_MINUTE: Record<string, number> = {
  'gpt-4o-mini-tts': 0.015,
  'tts-1': 0.015,
  'tts-1-hd': 0.03,
};

/** Strips the "openai:" adapter prefix; returns null for mock providers. */
export const modelName = (providerModel: string): string | null =>
  providerModel.startsWith('openai:') ? providerModel.slice('openai:'.length) : null;

const round = (value: number): number => Number(value.toFixed(6));

export function estimateChatCost(
  providerModel: string,
  usage: { promptTokens: number; cachedPromptTokens: number; completionTokens: number },
): number | null {
  const name = modelName(providerModel);
  const pricing = name ? CHAT_PRICING[name] : undefined;
  if (!pricing) return null;
  const uncached = Math.max(0, usage.promptTokens - usage.cachedPromptTokens);
  return round(
    (uncached * pricing.inputPerMillion +
      usage.cachedPromptTokens * pricing.cachedInputPerMillion +
      usage.completionTokens * pricing.outputPerMillion) /
      1_000_000,
  );
}

export function estimateSttCost(providerModel: string, audioSeconds: number): number | null {
  const name = modelName(providerModel);
  const perMinute = name ? STT_PRICING_PER_MINUTE[name] : undefined;
  return perMinute === undefined ? null : round((audioSeconds / 60) * perMinute);
}

/** Spoken English averages ~150 words per minute. */
export function estimateTtsCost(providerModel: string, words: number): number | null {
  const name = modelName(providerModel);
  const perMinute = name ? TTS_PRICING_PER_MINUTE[name] : undefined;
  return perMinute === undefined ? null : round((words / 150) * perMinute);
}

export const sumCosts = (...parts: (number | null)[]): number | null => {
  const present = parts.filter((part): part is number => part !== null);
  return present.length ? round(present.reduce((total, part) => total + part, 0)) : null;
};

import { encode } from 'gpt-tokenizer';

/** Token count using the GPT tokenizer – close enough to the embedding model's tokenizer for sizing. */
export const countTokens = (text: string): number => (text.length === 0 ? 0 : encode(text).length);

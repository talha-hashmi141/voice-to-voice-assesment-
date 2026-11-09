import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Short, human-friendly identifier, e.g. "TCK-4F7A2C". */
export const shortReference = (prefix: string): string =>
  `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

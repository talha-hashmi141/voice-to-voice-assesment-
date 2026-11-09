/** Collapses whitespace and trims; used before hashing / embedding / display. */
export const normaliseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

export const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

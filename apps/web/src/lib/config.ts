/** Public runtime configuration (inlined at build time by next.config.ts). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);
export const API_BASE = `${API_URL}/api`;

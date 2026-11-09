import { type ApiError } from '@voice-agent/contracts';
import { API_BASE } from './config';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/** Minimal typed fetch wrapper: JSON in/out, normalised errors, no framework lock-in. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let parsed: ApiError | null = null;
    try {
      parsed = (await response.json()) as ApiError;
    } catch {
      parsed = null;
    }
    throw new ApiClientError(response.status, parsed);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, init?: RequestOptions) => apiRequest<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'POST', body }),
  delete: <T>(path: string, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'DELETE' }),
};

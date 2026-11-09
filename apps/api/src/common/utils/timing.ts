/** High-resolution stopwatch used for per-stage latency metrics. */
export class Stopwatch {
  private readonly startedAt = performance.now();
  private readonly marks = new Map<string, number>();

  /** Milliseconds elapsed since construction. */
  elapsed(): number {
    return Math.round(performance.now() - this.startedAt);
  }

  /** Records the first occurrence of a named mark; later calls are ignored. */
  markOnce(name: string): number {
    const existing = this.marks.get(name);
    if (existing !== undefined) return existing;
    const value = this.elapsed();
    this.marks.set(name, value);
    return value;
  }

  mark(name: string): number {
    const value = this.elapsed();
    this.marks.set(name, value);
    return value;
  }

  get(name: string): number | null {
    return this.marks.get(name) ?? null;
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  const aborted = new Promise<never>((_, reject) => {
    if (!signal) return;
    if (signal.aborted) reject(new Error(`${label} aborted`));
    signal.addEventListener('abort', () => reject(new Error(`${label} aborted`)), { once: true });
  });
  try {
    return await Promise.race([promise, timeout, aborted]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

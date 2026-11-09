/**
 * Minimal unbounded async channel: producers `push`, a single consumer iterates.
 * Lets the voice pipeline merge events from the agent stream and from concurrently
 * finishing TTS jobs into one ordered event stream.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: {
    resolve: (result: IteratorResult<T>) => void;
    reject: (error: unknown) => void;
  }[] = [];
  private closed = false;
  private failure: unknown = null;

  push(item: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ value: item, done: false });
    else this.items.push(item);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0))
      waiter.resolve({ value: undefined as T, done: true });
  }

  fail(error: unknown): void {
    if (this.closed) return;
    this.failure = error;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.items.length)
          return Promise.resolve({ value: this.items.shift() as T, done: false });
        if (this.closed) {
          if (this.failure) return Promise.reject(this.failure);
          return Promise.resolve({ value: undefined as T, done: true });
        }
        return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
      },
    };
  }
}

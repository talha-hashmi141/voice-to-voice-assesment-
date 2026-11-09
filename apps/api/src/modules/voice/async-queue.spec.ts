import { AsyncQueue } from './async-queue';

describe('AsyncQueue', () => {
  it('delivers pushed items in order to an async consumer and ends on close', async () => {
    const queue = new AsyncQueue<number>();
    const received: number[] = [];
    const consumer = (async () => {
      for await (const item of queue) received.push(item);
    })();
    queue.push(1);
    await new Promise((r) => setTimeout(r, 5));
    queue.push(2);
    queue.push(3);
    queue.close();
    await consumer;
    expect(received).toEqual([1, 2, 3]);
  });

  it('rejects the consumer when failed', async () => {
    const queue = new AsyncQueue<number>();
    const consumer = (async () => {
      for await (const _item of queue) {
        /* drain */
      }
    })();
    queue.fail(new Error('boom'));
    await expect(consumer).rejects.toThrow('boom');
  });
});

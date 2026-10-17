import { describe, expect, it } from 'vitest';
import { create_queue } from './queue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => { resolve = resolver; });
  return { promise, resolve };
}

describe('library mutation queue', () => {
  it('starts the next write only after the previous write settles', async () => {
    const queue = create_queue();
    const first = deferred<boolean>();
    const calls: string[] = [];
    const first_result = queue.enqueue(async () => {
      calls.push('first');
      return first.promise;
    });
    const second_result = queue.enqueue(async () => {
      calls.push('second');
      return true;
    });

    await Promise.resolve();
    expect(calls).toEqual(['first']);
    first.resolve(true);
    await expect(first_result).resolves.toBe(true);
    await expect(second_result).resolves.toBe(true);
    expect(calls).toEqual(['first', 'second']);
  });

  it('continues with queued writes after a rejected write', async () => {
    const queue = create_queue();
    const second_result = queue.enqueue(async () => {
      throw new Error('offline');
    });
    const third_result = queue.enqueue(async () => 'saved');

    await expect(second_result).rejects.toThrow('offline');
    await expect(third_result).resolves.toBe('saved');
  });
});

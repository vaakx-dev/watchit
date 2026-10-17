import type { Priority } from './types.ts';

const MAX_DOWNLOADS = 6;
const MAX_BACKGROUND_DOWNLOADS = 2;

type Task = { run(): Promise<void>; reject(reason: unknown): void };

export function create_scheduler(signal: AbortSignal) {
  const visible = new Map<string, Task>();
  const background = new Map<string, Task>();
  const active = new Set<Promise<void>>();
  let active_background = 0;
  let stopped = false;

  function stop_reason() {
    return signal.reason ?? new Error('Image downloads stopped');
  }

  function pump() {
    while (!stopped && active.size < MAX_DOWNLOADS) {
      const foreground = visible.entries().next().value;
      const next = foreground ?? (active_background < MAX_BACKGROUND_DOWNLOADS ? background.entries().next().value : undefined);
      if (!next) return;
      const [key, task] = next;
      const is_background = !foreground;
      (is_background ? background : visible).delete(key);
      if (is_background) active_background++;
      const operation = Promise.resolve().then(task.run).finally(() => {
        active.delete(operation);
        if (is_background) active_background--;
        pump();
      });
      active.add(operation);
    }
  }

  function enqueue(queue: Map<string, Task>, key: string, task: Task) {
    queue.get(key)?.reject(new Error('Image download was replaced'));
    queue.set(key, task);
  }

  function schedule<T>(key: string, priority: Priority, operation: () => Promise<T>): Promise<T> {
    if (stopped || signal.aborted) return Promise.reject(stop_reason());
    return new Promise<T>((resolve, reject) => {
      const task: Task = {
        async run() {
          try { resolve(await operation()); }
          catch (cause) { reject(cause); }
        },
        reject,
      };
      enqueue(priority === 'visible' ? visible : background, key, task);
      pump();
    });
  }

  function promote(key: string) {
    const task = background.get(key);
    if (!task) return;
    background.delete(key);
    enqueue(visible, key, task);
    pump();
  }

  async function stop() {
    stopped = true;
    for (const queue of [visible, background]) {
      for (const task of queue.values()) task.reject(stop_reason());
      queue.clear();
    }
    await Promise.all(active);
  }

  signal.addEventListener('abort', () => { void stop(); }, { once: true });
  if (signal.aborted) void stop();

  return { schedule, promote, stop };
}

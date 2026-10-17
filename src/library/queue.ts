export function create_queue() {
  let tail = Promise.resolve();

  return {
    enqueue<T>(work: () => Promise<T>): Promise<T> {
      const result = tail.then(work);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

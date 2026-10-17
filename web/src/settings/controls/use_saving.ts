import { useCallback, useRef, useState } from 'react';

export type Saving = { state: 'idle' | 'saving' | 'saved' } | { state: 'failed'; error: string };

export function use_saving() {
  const [saving, set_saving] = useState<Saving>({ state: 'idle' });
  const latest = useRef(0);

  const track = useCallback(async <T,>(work: Promise<T>) => {
    const run = ++latest.current;
    set_saving({ state: 'saving' });
    try {
      const result = await work;
      if (run === latest.current) set_saving({ state: 'saved' });
      return result;
    } catch (cause) {
      if (run === latest.current) set_saving({ state: 'failed', error: cause instanceof Error ? cause.message : 'Could not save.' });
      throw cause;
    }
  }, []);

  return { saving, track };
}

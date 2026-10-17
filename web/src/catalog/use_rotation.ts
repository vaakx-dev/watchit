import { useEffect, useState } from 'react';

const INTERVAL = 8000;

export function use_rotation(count: number, paused: boolean) {
  const [index, set_index] = useState(0);
  const current = index < count ? index : 0;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setTimeout(() => set_index((current + 1) % count), INTERVAL);
    return () => clearTimeout(timer);
  }, [current, count, paused]);

  return [current, set_index] as const;
}

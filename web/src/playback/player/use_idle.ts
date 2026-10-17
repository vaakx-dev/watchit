import { useCallback, useEffect, useRef, useState } from 'react';

const HIDE_AFTER_MS = 3000;

export function use_idle(locked: boolean) {
  const [awake, set_awake] = useState(true);
  const [hovering, set_hovering] = useState(false);
  const timer = useRef(0);

  const wake = useCallback(() => {
    set_awake(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set_awake(false), HIDE_AFTER_MS);
  }, []);

  const sleep = useCallback(() => {
    window.clearTimeout(timer.current);
    set_awake(false);
  }, []);

  useEffect(() => {
    wake();
    return () => window.clearTimeout(timer.current);
  }, [wake]);

  return { shown: awake || locked || hovering, wake, sleep, hover: set_hovering };
}

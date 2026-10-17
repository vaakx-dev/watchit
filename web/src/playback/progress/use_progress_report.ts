import { useCallback, useEffect, useRef } from 'react';
import type { ProgressSaved } from '../../generated/library/ProgressSaved';
import { save_position } from './api';

const REPORT_EVERY_MS = 10000;

type Reading = { time: number; duration: number | null; paused: boolean; ready: boolean };

export function use_progress_report(title_id: string, reading: Reading, on_saved: (saved: ProgressSaved) => void) {
  const latest = useRef(reading);
  latest.current = reading;
  const saved_callback = useRef(on_saved);
  saved_callback.current = on_saved;
  const sent = useRef<number | null>(null);

  const report = useCallback(() => {
    const { time, duration, ready } = latest.current;
    const second = Math.round(time);
    if (!ready || !duration || time <= 0 || sent.current === second) return;
    sent.current = second;
    save_position(title_id, { position_seconds: time, duration_seconds: duration })
      .then(saved => saved_callback.current(saved), () => undefined);
  }, [title_id]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!latest.current.paused) report(); }, REPORT_EVERY_MS);
    window.addEventListener('pagehide', report);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', report);
      report();
    };
  }, [report]);

  useEffect(() => {
    if (reading.paused) report();
  }, [reading.paused, reading.ready, report]);
}

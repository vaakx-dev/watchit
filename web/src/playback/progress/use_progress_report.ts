import { useCallback, useEffect, useRef } from 'react';
import { save_position } from './api';

const REPORT_EVERY_MS = 10000;

type Reading = { time: number; duration: number | null; paused: boolean; ready: boolean };

export function use_progress_report(title_id: string, reading: Reading) {
  const latest = useRef(reading);
  latest.current = reading;
  const sent = useRef<number | null>(null);

  const report = useCallback(() => {
    const { time, duration, ready } = latest.current;
    const second = Math.round(time);
    if (!ready || !duration || time <= 0 || sent.current === second) return;
    sent.current = second;
    save_position(title_id, { position_seconds: time, duration_seconds: duration }).catch(() => undefined);
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

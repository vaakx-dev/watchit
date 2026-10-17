import type { Readiness } from '../../torrents/types';

export function wait_text(seconds: number) {
  if (seconds < 60) return 'less than a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return 'over a day';
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function readiness_text(readiness: Readiness) {
  if (readiness.state === 'ready') return 'Plays smoothly now';
  if (readiness.state !== 'waiting') return null;
  if (readiness.ready_in_seconds === null) return 'Waiting for download speed';
  return `Ready in about ${wait_text(readiness.ready_in_seconds)}`;
}

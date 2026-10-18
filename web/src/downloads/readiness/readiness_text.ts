import { duration_text } from '../../catalog/format';
import type { Readiness } from '../../torrents/types';

function wait_text(seconds: number) {
  if (seconds < 60) return 'under a minute';
  if (seconds >= 86400) return 'over a day';
  return `about ${duration_text(seconds)}`;
}

export function readiness_text(readiness: Readiness) {
  if (readiness.state === 'ready') return 'Plays smoothly now';
  if (readiness.state !== 'waiting') return null;
  if (readiness.ready_in_seconds === null) return 'Waiting for download speed';
  return `Ready in ${wait_text(readiness.ready_in_seconds)}`;
}

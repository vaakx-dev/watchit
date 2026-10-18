import type { SavedPosition } from './types';

export function runtime(minutes: number | null) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ');
}

export function time_left({ position_seconds, duration_seconds }: SavedPosition) {
  const minutes = Math.max(1, Math.ceil((duration_seconds - position_seconds) / 60));
  return minutes < 60 ? `${minutes} min left` : `${runtime(minutes)} left`;
}

export function watched_fraction({ position_seconds, duration_seconds }: SavedPosition) {
  return Math.min(1, Math.max(0, position_seconds / duration_seconds));
}

import { episode_code } from '../episodes';
import { opened_ago } from '../../library/opened';
import type { LibraryItem } from '../../library/types';

export function progress_line({ entry, progress, opened_at }: LibraryItem, now = new Date()) {
  const next = progress?.next;
  const paused = entry.status === 'paused';
  const opened = opened_at ? opened_ago(opened_at, now) : '';
  if (!next) return [paused ? 'Paused' : 'Watching', opened].filter(Boolean).join(' · ');
  return [paused ? 'Paused' : 'Next', episode_code(next), paused ? opened : next.title].filter(Boolean).join(' · ');
}

export function play_target({ title, progress }: LibraryItem) {
  if (progress?.next) return `#/watch/${progress.next.id}`;
  if (title.kind === 'movie') return `#/watch/${title.id}`;
  return null;
}

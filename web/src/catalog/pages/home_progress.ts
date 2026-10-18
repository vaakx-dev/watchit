import { episode_code } from '../episodes';
import { time_left } from '../format';
import type { LibraryItem } from '../../library/types';

export function item_resume({ progress, resume }: LibraryItem) {
  return progress ? progress.resume : resume;
}

export function progress_line(item: LibraryItem) {
  const { entry, progress } = item;
  const next = progress?.next;
  const resume = item_resume(item);
  const paused = entry.status === 'paused';
  const state = paused ? 'Paused' : resume ? time_left(resume) : null;
  if (!next) return state ?? 'Watching';
  return `${episode_code(next)} · ${state ?? next.title}`;
}

export function play_target({ title, progress }: LibraryItem) {
  if (progress?.next) return `#/watch/${progress.next.id}`;
  if (title.kind === 'movie') return `#/watch/${title.id}`;
  return null;
}

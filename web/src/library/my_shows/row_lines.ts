import { episode_code, season_label } from '../../catalog/episodes';
import { duration_text } from '../../catalog/format';
import { kind_label } from '../../catalog/kinds';
import type { SavedPosition } from '../../catalog/types';
import { opened_ago } from '../opened';
import type { LibraryItem } from '../types';

export type Action = { href: string; label: string; name: string };

function runtime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function time_left({ position_seconds, duration_seconds }: SavedPosition) {
  return `${duration_text(duration_seconds - position_seconds)} left`;
}

export function length_line({ title, minutes, seasons }: LibraryItem) {
  const length = title.kind === 'movie'
    ? minutes && runtime(minutes)
    : seasons && `${seasons} season${seasons === 1 ? '' : 's'}`;
  return [kind_label(title), title.year, length].filter(Boolean).join(' · ');
}

export function added_line({ status_changed_at }: LibraryItem) {
  return status_changed_at ? `Added ${opened_ago(status_changed_at)}` : null;
}

export function progress_lines(item: LibraryItem) {
  const { title, progress, resume, seasons, season_episodes } = item;
  const next = progress?.next;
  if (next) {
    const season = next.season ?? 0;
    const done = Math.max(0, (next.episode ?? 1) - 1);
    const fresh = done === 0 && season > 1;
    return {
      line: [episode_code(next), next.title].filter(Boolean).join(' · '),
      note: [fresh ? 'New season' : season_episodes ? `${done} of ${season_episodes}` : '', season_label(season)].filter(Boolean).join(' · '),
      fraction: fresh ? (seasons ? (season - 1) / seasons : 0) : season_episodes ? done / season_episodes : 0,
    };
  }
  if (title.kind === 'movie' && resume && resume.duration_seconds > 0) {
    return { line: `${kind_label(title)} · ${time_left(resume)}`, note: null, fraction: resume.position_seconds / resume.duration_seconds };
  }
  return null;
}

export function play_action({ title, progress, resume }: LibraryItem): Action | null {
  const next = progress?.next;
  if (next) {
    const code = episode_code(next);
    return { href: `#/watch/${next.id}`, label: code, name: `Play ${title.title} ${code}` };
  }
  if (title.kind !== 'movie') return null;
  const label = resume ? 'Resume' : 'Play';
  return { href: `#/watch/${title.id}`, label, name: `${label} ${title.title}` };
}

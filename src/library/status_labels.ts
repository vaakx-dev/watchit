import type { Status } from './types';

export const STATUS_LABELS: Record<Status, string> = {
  want: 'Want to watch',
  watching: 'Watching',
  paused: 'Paused',
  watched: 'Watched',
  dropped: 'Dropped',
};

import type { SavedPosition } from '../../catalog/types';

const MIN_RESUME_SHARE = 0.05;
const MAX_RESUME_SHARE = 0.9;

export function resume_at(position: SavedPosition | null | undefined) {
  if (!position || position.duration_seconds <= 0) return 0;
  const share = position.position_seconds / position.duration_seconds;
  return share >= MIN_RESUME_SHARE && share <= MAX_RESUME_SHARE ? position.position_seconds : 0;
}

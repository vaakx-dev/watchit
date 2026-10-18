import { watched_fraction } from '../format';
import type { SavedPosition } from '../types';

export function ProgressBar({ resume, watched = false }: { resume: SavedPosition | null; watched?: boolean }) {
  const fraction = watched ? 1 : resume ? watched_fraction(resume) : 0;
  return <span className="progress-bar" aria-hidden="true"><span style={{ width: `${fraction * 100}%` }} /></span>;
}

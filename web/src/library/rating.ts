import { RATINGS, type Rating } from './types';

export function at(position: number): Rating {
  return RATINGS[Math.max(0, Math.min(RATINGS.length - 1, Math.ceil(position * RATINGS.length) - 1))]!;
}

export function step(value: Rating | null, key: string): Rating | null | undefined {
  const index = value === null ? -1 : RATINGS.indexOf(value);
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': return RATINGS[Math.min(RATINGS.length - 1, index + 1)];
    case 'ArrowLeft': case 'ArrowDown': return RATINGS[Math.max(0, index - 1)];
    case 'Home': return RATINGS[0];
    case 'End': return RATINGS[RATINGS.length - 1];
    case 'Delete': case 'Backspace': return null;
    default: return undefined;
  }
}

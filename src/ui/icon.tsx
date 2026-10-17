export type IconName =
  | 'backspace' | 'badge-recommended' | 'check' | 'chevron' | 'close' | 'eye' | 'eye-dropped' | 'eye-recommended' | 'eye-dropped-recommended' | 'film' | 'lock'
  | 'nav-browse' | 'nav-home' | 'nav-lists' | 'nav-rankings' | 'nav-stats'
  | 'play' | 'plus' | 'star' | 'search' | 'info' | 'settings'
  | 'pupil-heart' | 'pupil-it-a' | 'pupil-it-b' | 'pupil-paused'
  | 'pupil-want' | 'pupil-watched' | 'pupil-watching';

export function Icon({ name, size, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <span aria-hidden="true" className={`icon ${className}`} style={{ width: size, height: size, maskImage: `url(/icons/${name}.svg)` }} />;
}

import { Icon } from './icon';

export type Pupil = 'want' | 'watching' | 'paused' | 'watched' | 'heart' | 'it-a' | 'it-b';

export function Eye({ pupil, dropped = false, recommended = false }: { pupil?: Pupil; dropped?: boolean; recommended?: boolean }) {
  return <span className="eye" aria-hidden="true">
    <Icon name={`${dropped ? 'eye-dropped' : 'eye'}${recommended ? '-recommended' : ''}`} className="eye-outline" />
    {pupil && <Icon name={`pupil-${pupil}`} className="eye-pupil" />}
    {recommended && <Icon name="badge-recommended" className="eye-badge" />}
  </span>;
}

export type Pupil = 'want' | 'watching' | 'paused' | 'watched' | 'heart' | 'it-a' | 'it-b';

function Mark({ name, className }: { name: string; className: string }) {
  return <span className={`eye-mark ${className}`} style={{ maskImage: `url(/icons/${name}.svg)` }} />;
}

export function Eye({ pupil, dropped = false, recommended = false }: { pupil?: Pupil; dropped?: boolean; recommended?: boolean }) {
  return <span className="eye" aria-hidden="true">
    <Mark name={`${dropped ? 'eye-dropped' : 'eye'}${recommended ? '-recommended' : ''}`} className="eye-outline" />
    {pupil && <Mark name={`pupil-${pupil}`} className="eye-pupil" />}
    {recommended && <Mark name="badge-recommended" className="eye-badge" />}
  </span>;
}

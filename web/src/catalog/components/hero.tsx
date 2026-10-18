import type { ReactNode } from 'react';
import { Info, Play } from 'lucide-react';
import { Backdrop } from './backdrop';
import { Heading } from './heading';
import { ImdbScore } from './imdb_score';
import { play_label } from '../episodes';
import type { Title } from '../types';
import type { SeriesProgress } from '../../library/types';
import type { Library } from '../../library/use_library';
import { StatusControls } from '../../library/components/status';

function PrimaryAction({ title, progress }: { title: Title; progress: SeriesProgress | null }) {
  if (title.kind !== 'series') return <a className="button primary" href={`#/watch/${title.id}`}><Play fill="currentColor" />Play</a>;
  if (progress?.next) return <a className="button primary" href={`#/watch/${progress.next.id}`}><Play fill="currentColor" />{play_label(progress.next)}</a>;
  return <a className="button primary" href={`#/title/${title.id}`}>View episodes</a>;
}

export function Hero({ title, reason, progress, library, children }: {
  title: Title;
  reason: ReactNode;
  progress: SeriesProgress | null;
  library: Library;
  children?: ReactNode;
}) {
  const genres = title.genres.slice(0, 2);

  return (
    <section className="hero" aria-labelledby="featured-title">
      <div className={`hero-art${title.backdrop ? '' : ' blurred'}`}><Backdrop src={title.backdrop || title.artwork} /></div>
      <div className="hero-copy">
        <p className="hero-reason">{reason}</p>
        <Heading title={title.title} />
        <div className="meta">
          {title.year && <span>{title.year}</span>}
          {genres.length > 0 && <span>{genres.join(', ')}</span>}
          <ImdbScore score={title.imdb_rating} />
        </div>
        {title.synopsis && <p className="synopsis">{title.synopsis}</p>}
        <div className="hero-actions">
          <PrimaryAction title={title} progress={progress} />
          {title.kind !== 'episode' && <StatusControls title={title} library={library} />}
          <a className="icon-button hero-info" href={`#/title/${title.id}`} aria-label={`About ${title.title}`} title="Details"><Info /></a>
        </div>
        {children}
      </div>
    </section>
  );
}

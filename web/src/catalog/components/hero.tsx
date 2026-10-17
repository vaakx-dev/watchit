import type { ReactNode } from 'react';
import { Info, Play } from 'lucide-react';
import { Backdrop } from './backdrop';
import { Heading } from './heading';
import { ImdbScore } from './imdb_score';
import { play_label } from '../episodes';
import { runtime } from '../format';
import type { Title } from '../types';
import type { SeriesProgress } from '../../library/types';
import type { Library } from '../../library/use_library';
import { StatusControls } from '../../library/components/status';

const KINDS: Record<Title['kind'], string> = { movie: 'Movie', series: 'Series', episode: 'Episode' };

function PrimaryAction({ title, progress }: { title: Title; progress: SeriesProgress | null }) {
  if (title.kind !== 'series') return <a className="button primary" href={`#/watch/${title.id}`}><Play fill="currentColor" />Play</a>;
  if (progress?.next) return <a className="button primary" href={`#/watch/${progress.next.id}`}><Play fill="currentColor" />{play_label(progress.next, progress.last)}</a>;
  return <a className="button primary" href={`#/title/${title.id}`}>View episodes</a>;
}

export function Hero({ title, reason, progress, library }: {
  title: Title;
  reason: ReactNode;
  progress: SeriesProgress | null;
  library: Library;
}) {
  const genres = title.genres.slice(0, 2);

  return (
    <section className="hero" aria-labelledby="featured-title">
      <div className={`hero-art${title.backdrop ? '' : ' blurred'}`}><Backdrop src={title.backdrop || title.artwork} /></div>
      <div className="hero-copy">
        <p className="hero-reason">{reason}</p>
        <Heading title={title.title} />
        <div className="meta">
          <span>{title.anime ? 'Anime' : KINDS[title.kind]}</span>
          {title.year && <span>{title.year}</span>}
          {title.minutes && <span>{runtime(title.minutes)}</span>}
          {genres.length > 0 && <span>{genres.join(', ')}</span>}
          <ImdbScore score={title.imdb_rating} />
        </div>
        {title.synopsis && <p className="synopsis">{title.synopsis}</p>}
        {title.series && <a className="external-link" href={`#/title/${title.series.id}`}>{title.series.title}</a>}
        <div className="hero-actions">
          <PrimaryAction title={title} progress={progress} />
          {title.kind !== 'episode' && <StatusControls title={title} library={library} labelled />}
          <a className="button secondary" href={`#/title/${title.id}`}><Info />Details</a>
        </div>
      </div>
    </section>
  );
}

import { Icon } from '../../ui/icon';
import { Artwork } from '../components/artwork';
import { Backdrop } from '../components/backdrop';
import { Heading } from '../components/heading';
import { ImdbScore } from '../components/imdb_score';
import { TrailerAction } from '../components/trailer';
import { episode_code, play_label } from '../episodes';
import { runtime } from '../format';
import { discover_route } from '../../navigation/route';
import { DownloadTitleButton } from '../../downloads/actions/download_title_button';
import { StatusControls } from '../../library/components/status';
import { TitleRating } from '../../library/components/title_rating';
import type { SeriesProgress } from '../../library/types';
import type { Library } from '../../library/use_library';
import type { Title } from '../types';

const KINDS: Record<Title['kind'], string> = { movie: 'Movie', series: 'Series', episode: 'Episode' };
const RATING_LABELS: Record<Title['kind'], string> = { movie: 'Your rating', series: 'Series rating', episode: 'Your rating' };

function show_episodes() {
  const episodes = document.getElementById('episodes');
  episodes?.scrollIntoView();
  episodes?.focus({ preventScroll: true });
}

function BackLink({ title }: { title: Title }) {
  const content = (label: string) => <><Icon name="chevron" className="previous" /><span>{label}</span></>;
  if (title.series) return <a className="back-link title-back" href={`#/title/${title.series.id}`}>{content(title.series.title)}</a>;
  const kind = title.anime ? 'anime' : title.kind === 'movie' ? 'movie' : 'series';
  return <a className="back-link title-back" href={discover_route(kind)}>{content('Discover')}</a>;
}

function PlayAction({ title, progress }: { title: Title; progress: SeriesProgress | null }) {
  const play = <Icon name="play" />;
  if (title.kind !== 'series') return <a className="button primary" href={`#/watch/${title.id}`}>{play}Play</a>;
  if (progress?.next) return <a className="button primary" href={`#/watch/${progress.next.id}`}>{play}{play_label(progress.next, progress.last)}</a>;
  return <button className="button primary" onClick={show_episodes}>View episodes</button>;
}

export function TitleHero({ title, progress, seasons, library }: { title: Title; progress: SeriesProgress | null; seasons: number; library: Library }) {
  const saved = library.entries[title.id]?.saved ?? false;

  return <section className="title-hero" aria-labelledby="featured-title">
    <div className={`title-hero-art${title.backdrop ? '' : ' blurred'}`}><Backdrop src={title.backdrop || title.artwork} /></div>
    <BackLink title={title} />
    <div className="title-hero-body">
      <div className="title-poster"><Artwork src={title.artwork} label={title.title} /></div>
      <div className="title-copy">
        <Heading title={title.title} />
        <div className="meta">
          <span>{title.anime ? 'Anime' : KINDS[title.kind]}</span>
          {title.kind === 'episode' && <span>{episode_code(title)}</span>}
          {title.year && <span>{title.year}</span>}
          {seasons > 0 && <span>{seasons === 1 ? '1 season' : `${seasons} seasons`}</span>}
          {title.minutes && <span>{runtime(title.minutes)}</span>}
          <ImdbScore score={title.imdb_rating} />
        </div>
        {title.genres.length > 0 && <ul className="genre-list" aria-label="Genres">{title.genres.map(genre => <li key={genre}>{genre}</li>)}</ul>}
        {title.synopsis && <p className="synopsis">{title.synopsis}</p>}
        <div className="title-actions">
          <PlayAction title={title} progress={progress} />
          {title.kind !== 'episode' && <StatusControls title={title} library={library} labelled />}
          <TrailerAction title={title.title} trailers={title.trailers ?? []} />
          {title.kind !== 'series' && <DownloadTitleButton title={title} />}
          <button type="button" className="icon-button" disabled={!library.ready} aria-label="Save" title="Save"
            aria-pressed={saved} onClick={() => { void library.toggle_saved(title); }}><Icon name="nav-lists" /></button>
        </div>
        <div className="your-rating"><span>{RATING_LABELS[title.kind]}</span><TitleRating title={title} library={library} /></div>
        {(title.director || title.cast) && <dl className="credits">
          {title.director && <div><dt>Director</dt><dd>{title.director}</dd></div>}
          {title.cast && <div><dt>Cast</dt><dd>{title.cast}</dd></div>}
        </dl>}
      </div>
    </div>
  </section>;
}

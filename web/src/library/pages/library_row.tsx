import { Artwork } from '../../catalog/components/artwork';
import { episode_code } from '../../catalog/episodes';
import { Icon } from '../../ui/icon';
import { StatusControls } from '../components/status';
import { TitleRating } from '../components/title_rating';
import { opened_ago } from '../opened';
import type { LibraryItem, PersonalEntry, Rating } from '../types';
import type { Library } from '../use_library';
import { kind_label } from './kinds';

function SeasonRatings({ ratings }: { ratings?: Record<number, Rating> }) {
  const seasons = Object.entries(ratings ?? {}).map(([season, rating]) => [Number(season), rating] as const).sort(([a], [b]) => a - b);
  if (!seasons.length) return null;
  return <ul className="season-ratings" aria-label="Season ratings">
    {seasons.map(([season, rating]) => <li key={season}>S{season} <Icon name="star" size={10} /><b>{rating}</b></li>)}
  </ul>;
}

function Play({ item, entry }: { item: LibraryItem; entry: PersonalEntry }) {
  const next = item.progress?.next;
  if (next) {
    const code = episode_code(next);
    return <a className="button primary small" href={`#/watch/${next.id}`} aria-label={`Play ${item.title.title} ${code}`}><Icon name="play" />{code}</a>;
  }
  if (item.title.kind !== 'movie' || entry.status === 'watched' || entry.status === 'dropped') return null;
  return <a className="button primary small" href={`#/watch/${item.title.id}`} aria-label={`Play ${item.title.title}`}><Icon name="play" />Play</a>;
}

export function LibraryRow({ item, library }: { item: LibraryItem; library: Library }) {
  const { title, opened_at } = item;
  const entry = library.entries[title.id] ?? item.entry;
  const next = item.progress?.next;
  const href = `#/title/${title.id}`;

  return <li className="library-row">
    <a className="library-poster" href={href} tabIndex={-1} aria-hidden="true"><Artwork src={title.artwork} label={title.title} /></a>
    <div className="library-copy">
      <h3><a href={href}>{title.title}</a></h3>
      <p className="meta">
        {next && <span className="library-next" data-status={entry.status ?? undefined}>Next {episode_code(next)}</span>}
        <span>{kind_label(title)}</span>
        {title.year && <span className="library-year">{title.year}</span>}
        {opened_at && <span>opened {opened_ago(opened_at)}</span>}
      </p>
      {title.kind === 'series' && <SeasonRatings ratings={library.seasons[title.id]} />}
    </div>
    <div className="library-rating"><TitleRating title={title} library={library} /></div>
    <StatusControls title={title} library={library} />
    <div className="library-play"><Play item={item} entry={entry} /></div>
  </li>;
}

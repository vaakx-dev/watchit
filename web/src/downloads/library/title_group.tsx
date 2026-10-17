import { Artwork } from '../../catalog/components/artwork';
import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { use_title, watch_href } from '../titles';
import type { LibraryGroup } from './library_groups';
import { LibraryRow } from './library_row';
import { SeasonBlock } from './season_block';

function fallback_name(group: LibraryGroup) {
  return group.movies[0]?.name ?? group.seasons[0]?.episodes[0]?.transfer.name ?? group.id;
}

export function TitleGroup({ group, on_remove }: { group: LibraryGroup; on_remove: (transfer: Transfer) => void }) {
  const title = use_title(group.id);
  const name = title?.title ?? fallback_name(group);
  const episodes = group.seasons.reduce((total, shelf) => total + shelf.episodes.length, 0);
  const href = `#/title/${group.id}`;

  return <li className="library-group">
    <a className="library-poster" href={href} tabIndex={-1} aria-hidden="true"><Artwork src={title?.artwork ?? ''} label={name} /></a>
    <div className="library-body">
      <header>
        <h3><a href={href}>{name}</a></h3>
        <p className="meta">
          {title?.year && <span>{title.year}</span>}
          {episodes > 0 && <span>{episodes === 1 ? '1 episode' : `${episodes} episodes`}</span>}
          <span>{bytes(group.size)}</span>
        </p>
      </header>
      {group.movies.length > 0 && <ul className="library-rows">
        {group.movies.map(movie => <LibraryRow key={movie.id} label={null} name={movie.name} size={movie.size_bytes}
          href={watch_href(movie.title_id)} on_remove={() => on_remove(movie)} />)}
      </ul>}
      {group.seasons.map(shelf => <SeasonBlock key={shelf.season} shelf={shelf} open={group.seasons.length === 1} on_remove={on_remove} />)}
    </div>
  </li>;
}

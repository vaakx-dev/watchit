import type { Transfer } from '../../torrents/types';
import { library_items } from './library_groups';
import { MovieRow } from './movie_row';
import { ShowRow } from './show_row';

export function DownloadedSection({ transfers }: { transfers: Transfer[] }) {
  if (!transfers.length) return null;
  return <section className="downloads-section" aria-labelledby="downloaded-heading">
    <header className="downloads-heading"><h2 id="downloaded-heading">Downloaded</h2></header>
    <ul className="download-list">
      {library_items(transfers).map(item => item.kind === 'movie'
        ? <MovieRow key={item.transfer.id} transfer={item.transfer} />
        : <ShowRow key={item.show.id} show={item.show} />)}
    </ul>
  </section>;
}

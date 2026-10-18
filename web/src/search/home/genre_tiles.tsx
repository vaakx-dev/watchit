import { use_catalog } from '../../catalog/api';
import { genre_color } from '../../discover/genres/genre_colors';
import { discover_href } from '../../navigation/discover';

export function GenreTiles() {
  const { resource } = use_catalog({ kind: 'all', sort: 'trending' });
  const genres = resource.status === 'ready' ? resource.data.genres.filter(genre => !genre.minor) : [];
  if (!genres.length) return null;

  return <section className="search-section" aria-labelledby="search-browse">
    <div className="search-heading"><h2 id="search-browse">Browse</h2></div>
    <div className="genre-tiles">
      {genres.map(genre => <a key={genre.id} className="genre-tile" href={discover_href({ genre: genre.id })}
        style={{ backgroundColor: genre_color(genre.id) }}>{genre.label}</a>)}
    </div>
  </section>;
}

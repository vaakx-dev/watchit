import { use_catalog } from '../../catalog/api';
import { discover_href } from '../../navigation/discover';
import { hue } from '../../ui/hue';

export function GenreTiles() {
  const { resource } = use_catalog({ kind: 'all', sort: 'trending' });
  const genres = resource.status === 'ready' ? resource.data.genres.filter(genre => !genre.minor) : [];
  if (!genres.length) return null;

  return <section className="search-section" aria-labelledby="search-browse">
    <div className="search-heading"><h2 id="search-browse">Browse</h2></div>
    <ul className="genre-tiles">
      {genres.map(genre => <li key={genre.id}>
        <a href={discover_href({ genre: genre.id })} style={{ backgroundColor: `hsl(${hue(genre.id)} 34% 17%)` }}>{genre.label}</a>
      </li>)}
    </ul>
  </section>;
}

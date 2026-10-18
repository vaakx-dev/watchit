import { Artwork } from '../../catalog/components/artwork';
import { awaiting_items } from '../../catalog/api';
import { use_trending } from '../../catalog/use_trending';

const SHOWN = 12;

export function TrendingPosters() {
  const { resource } = use_trending({});
  const items = resource.status === 'ready' ? resource.data.items.slice(0, SHOWN) : [];
  if (!awaiting_items(resource) && !items.length) return null;

  return <section className="search-section" aria-labelledby="search-trending">
    <div className="search-heading"><h2 id="search-trending">Trending</h2></div>
    <ul className="poster-grid" aria-busy={awaiting_items(resource) || undefined}>
      {items.length ? items.map((entry, index) => <li key={entry.id}>
        <a href={`#/title/${entry.id}`} aria-label={`${entry.title}${entry.year ? `, ${entry.year}` : ''}`} title={entry.title}>
          <Artwork src={entry.artwork} label={entry.title} eager={index < 6} />
        </a>
      </li>) : Array.from({ length: SHOWN }, (_, index) => <li key={index} className="skeleton-block" aria-hidden="true" />)}
    </ul>
  </section>;
}

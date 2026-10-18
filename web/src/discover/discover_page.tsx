import { useState } from 'react';
import { use_catalog } from '../catalog/api';
import type { CatalogKind, CatalogQuery, GenreOption } from '../catalog/types';
import type { Library } from '../library/use_library';
import { DISCOVER_DEFAULTS, discover_href, type DiscoverQuery } from '../navigation/discover';
import { scroll_to_top } from '../navigation/scroll';
import { DiscoverFilters } from './discover_filters';
import { genre_label } from './genres/genre_menu';
import { Results } from './results/results';
import { count_label, narrowed, summary } from './summary';

export function DiscoverPage({ query, library }: { query: DiscoverQuery; library: Library }) {
  const [genres, set_genres] = useState<{ kind: CatalogKind; options: readonly GenreOption[] }>({ kind: query.kind, options: [] });
  const catalog: Omit<CatalogQuery, 'page'> = { kind: query.kind, sort: query.sort, genre: query.genre, query: '', hide: query.hide_watched ? ['watched'] : [] };
  const first = use_catalog({ ...catalog, page: 1 });
  const data = first.resource.status === 'ready' ? first.resource.data : null;
  if (data && (data.genres !== genres.options || genres.kind !== query.kind)) set_genres({ kind: query.kind, options: data.genres });
  const shown_genres = genres.kind === query.kind ? genres.options : [];
  const filtered = narrowed(query) || query.hide_watched !== DISCOVER_DEFAULTS.hide_watched;

  function change(next: Partial<DiscoverQuery>) {
    window.location.hash = discover_href({ ...query, ...next });
    scroll_to_top();
  }

  return <section className="discover page-gutter" aria-labelledby="discover-title">
    <h1 className="sr-only" id="discover-title">Discover</h1>
    <DiscoverFilters query={query} genres={shown_genres} count={data ? count_label(data.total) : null} on_change={change} />
    {narrowed(query) && data && <p className="discover-summary">
      <span>{summary(query, query.genre ? genre_label(shown_genres, query.genre) : '')}</span>
      <span>{data.total.toLocaleString()}</span>
    </p>}
    <Results key={discover_href(query)} first={first} query={catalog} meta={query.kind === 'all' ? 'kind' : 'rating'} library={library}
      on_reset={filtered ? () => change(DISCOVER_DEFAULTS) : null} />
  </section>;
}

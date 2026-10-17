import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { EmptyState } from '../../ui/empty_state';
import { Page } from '../../ui/page';
import { SectionHeader } from '../../ui/section_header';
import { GridSkeleton } from '../components/skeleton';
import { TitleGrid } from '../components/title_grid';
import { CatalogStatus } from '../components/status';
import { awaiting_items, use_catalog } from '../api';
import { DISCOVER_DEFAULTS, discover_href, type DiscoverQuery } from '../../navigation/discover';
import type { Route } from '../../navigation/route';
import type { GenreOption } from '../types';
import type { Library } from '../../library/use_library';
import { CollectionFilters, SORT_LABELS } from './collection_filters';

function page_title(searching: boolean, query: string) {
  if (!searching) return 'Discover';
  return query ? `Results for “${query}”` : 'Search';
}

function results_title({ sort, genre }: DiscoverQuery, genres: readonly GenreOption[]) {
  if (!genre) return SORT_LABELS[sort];
  return `${SORT_LABELS[sort]} in ${genres.find(option => option.id === genre)?.label ?? genre}`;
}

export function Collection({ route, library }: { route: Extract<Route, { view: 'discover' | 'search' }>; library: Library }) {
  const [search_filters, set_search_filters] = useState(DISCOVER_DEFAULTS);
  const [genres, set_genres] = useState<readonly GenreOption[]>([]);
  const searching = route.view === 'search';
  const query = searching ? route.query.trim() : '';
  const filters = searching ? search_filters : route.query;
  const { resource, retry } = use_catalog(searching && !query ? null : { ...filters, query });
  const titles = resource.status === 'ready' ? resource.data.items : [];
  const filtered = filters.kind !== 'all' || filters.genre !== '' || filters.hide.length > 0;
  if (resource.status === 'ready' && resource.data.genres !== genres) set_genres(resource.data.genres);

  function change(next: Partial<DiscoverQuery>) {
    const updated = { ...filters, page: 1, ...next };
    if (searching) set_search_filters(updated);
    else window.location.hash = discover_href(updated);
  }

  function change_page(page: number) {
    change({ page });
    window.scrollTo(0, 0);
  }

  function reset() {
    change({ kind: 'all', genre: '', hide: [] });
  }

  return (
    <Page title={page_title(searching, query)}>
      <CollectionFilters filters={filters} genres={genres} on_change={change} />
      {!searching && <SectionHeader id="results-title" title={results_title(filters, genres)} />}
      {searching && !query ? <EmptyState icon={Search} title="Search the catalog"><p>Type a title in the search field and press Enter.</p></EmptyState>
        : resource.status === 'error' ? <CatalogStatus error={resource.error} retry={retry} />
        : awaiting_items(resource) ? <GridSkeleton />
        : titles.length ? <TitleGrid entries={titles} library={library} />
        : resource.status === 'ready' && resource.data.imports?.error ? <CatalogStatus error={resource.data.imports.error} retry={retry} />
        : <EmptyState icon={Search} title="No titles found">
          <p>{filtered ? 'Change or reset the filters.' : 'Try a different spelling or a shorter title.'}</p>
          {filtered && <button className="button secondary" onClick={reset}><X />Reset filters</button>}
        </EmptyState>}
      {resource.status === 'ready' && (filters.page > 1 || resource.data.has_next) && <nav className="pagination" aria-label="Catalog pages">
        <button className="button secondary" disabled={filters.page === 1} onClick={() => change_page(filters.page - 1)}><ChevronLeft />Previous</button>
        <span aria-live="polite">Page {resource.data.page}</span>
        <button className="button secondary" disabled={!resource.data.has_next} onClick={() => change_page(filters.page + 1)}>Next<ChevronRight /></button>
      </nav>}
    </Page>
  );
}

import { scroll_to_top } from '../../navigation/scroll';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { EmptyState } from '../../ui/empty_state';
import { Page } from '../../ui/page';
import { GridSkeleton } from '../components/skeleton';
import { TitleGrid } from '../components/title_grid';
import { CatalogStatus } from '../components/status';
import { awaiting_items, use_catalog } from '../api';
import type { CatalogKind, GenreOption } from '../types';
import type { Library } from '../../library/use_library';
import { CollectionFilters, SEARCH_DEFAULTS, type SearchFilters } from './collection_filters';

export function Collection({ query: typed, library }: { query: string; library: Library }) {
  const [filters, set_filters] = useState(SEARCH_DEFAULTS);
  const [genres, set_genres] = useState<{ kind: CatalogKind; options: readonly GenreOption[] }>({ kind: 'all', options: [] });
  const query = typed.trim();
  const { resource, retry } = use_catalog(query ? { ...filters, query } : null);
  const titles = resource.status === 'ready' ? resource.data.items : [];
  const filtered = filters.kind !== 'all' || filters.genre !== '' || filters.hide.length > 0;
  if (resource.status === 'ready' && (resource.data.genres !== genres.options || genres.kind !== filters.kind)) set_genres({ kind: filters.kind, options: resource.data.genres });
  const shown_genres = genres.kind === filters.kind ? genres.options : [];

  function change(next: Partial<SearchFilters>) {
    set_filters({ ...filters, page: 1, ...next });
  }

  function change_page(page: number) {
    change({ page });
    scroll_to_top();
  }

  function reset() {
    change({ kind: 'all', genre: '', hide: [] });
  }

  return (
    <Page title={query ? `Results for “${query}”` : 'Search'}>
      <CollectionFilters filters={filters} genres={shown_genres} on_change={change} />
      {!query ? <EmptyState icon={Search} title="Search the catalog"><p>Type a title in the search field and press Enter.</p></EmptyState>
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

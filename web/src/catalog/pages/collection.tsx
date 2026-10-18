import { scroll_to_top } from '../../navigation/scroll';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { EmptyState } from '../../ui/empty_state';
import { Page } from '../../ui/page';
import { SectionHeader } from '../../ui/section_header';
import { GridSkeleton } from '../components/skeleton';
import { TitleGrid } from '../components/title_grid';
import { CatalogStatus } from '../components/status';
import { awaiting_items, use_catalog } from '../api';
import { discover_href, type DiscoverQuery } from '../../navigation/discover';
import type { CatalogKind, GenreOption } from '../types';
import type { Library } from '../../library/use_library';
import { SORT_LABELS } from '../../search/filters/title_filters';
import { CollectionFilters } from './collection_filters';

function results_title({ sort, genre }: DiscoverQuery, genres: readonly GenreOption[]) {
  if (!genre) return SORT_LABELS[sort];
  return `${SORT_LABELS[sort]} in ${genres.find(option => option.id === genre)?.label ?? genre}`;
}

export function Collection({ query: filters, library }: { query: DiscoverQuery; library: Library }) {
  const [genres, set_genres] = useState<{ kind: CatalogKind; options: readonly GenreOption[] }>({ kind: 'all', options: [] });
  const { resource, retry } = use_catalog(filters);
  const titles = resource.status === 'ready' ? resource.data.items : [];
  const filtered = filters.kind !== 'all' || filters.genre !== '' || filters.hide.length > 0;
  if (resource.status === 'ready' && (resource.data.genres !== genres.options || genres.kind !== filters.kind)) set_genres({ kind: filters.kind, options: resource.data.genres });
  const shown_genres = genres.kind === filters.kind ? genres.options : [];

  function change(next: Partial<DiscoverQuery>) {
    window.location.hash = discover_href({ ...filters, page: 1, ...next });
  }

  function change_page(page: number) {
    change({ page });
    scroll_to_top();
  }

  function reset() {
    change({ kind: 'all', genre: '', hide: [] });
  }

  return (
    <Page title="Discover">
      <CollectionFilters filters={filters} genres={shown_genres} on_change={change} />
      <SectionHeader id="results-title" title={results_title(filters, shown_genres)} />
      {resource.status === 'error' ? <CatalogStatus error={resource.error} retry={retry} />
        : awaiting_items(resource) ? <GridSkeleton />
        : titles.length ? <TitleGrid entries={titles} library={library} />
        : resource.status === 'ready' && resource.data.imports?.error ? <CatalogStatus error={resource.data.imports.error} retry={retry} />
        : <EmptyState icon={Search} title="No titles found">
          <p>{filtered ? 'Change or reset the filters.' : 'No titles in the catalog yet.'}</p>
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

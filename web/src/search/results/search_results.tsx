import { useState } from 'react';
import { Search } from 'lucide-react';
import { awaiting_items, use_catalog } from '../../catalog/api';
import { Card } from '../../catalog/components/card';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogEntry, CatalogKind, CatalogPage, CatalogSort } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { EmptyState } from '../../ui/empty_state';
import { FilterBar } from '../filters/filter_bar';
import type { FilterChange, TitleFilters } from '../filters/title_filters';
import { NextPage } from './result_pages';
import { ResultRow } from './result_row';
import { ResultsSkeleton } from './results_skeleton';
import { TopResult } from './top_result';

export const SEARCH_SORTS: readonly CatalogSort[] = ['relevance', 'top_rated', 'newest', 'title'];
export const SEARCH_DEFAULTS: TitleFilters = { kind: 'all', sort: 'relevance', genre: '', hide: [] };

const GRID_TITLES: Record<CatalogKind, string> = { all: 'Movies & shows', movie: 'Movies', series: 'Series', anime: 'Anime' };

type Props = { query: string; filters: TitleFilters; compact: boolean; library: Library; on_change: FilterChange };

function grid_details(entry: CatalogEntry) {
  return [entry.year, entry.kind === 'series' ? 'Series' : ''].filter(Boolean).join(' · ');
}

function use_latest(page: CatalogPage | undefined) {
  const [latest, set_latest] = useState(page);
  if (page && page !== latest) set_latest(page);
  return page ?? latest;
}

export function SearchResults({ query, filters, compact, library, on_change }: Props) {
  const request = { ...filters, query };
  const { resource, retry } = use_catalog({ ...request, page: 1 });
  const data = use_latest(resource.status === 'ready' ? resource.data : undefined);
  const items = data?.items ?? [];
  const featured = filters.sort === 'relevance' ? items[0] : undefined;
  const rest = featured ? items.slice(1) : items;
  const filtered = filters.kind !== 'all' || filters.genre !== '' || filters.hide.length > 0;
  const key = JSON.stringify(request);

  const render_row = (entry: CatalogEntry) => <ResultRow key={entry.id} entry={entry} query={query} library={library} />;
  const render_cell = (entry: CatalogEntry) => <li key={entry.id}><Card entry={entry} library={library} details={grid_details(entry)} /></li>;
  const render = compact ? render_row : render_cell;
  const list = <>
    {rest.map(render)}
    {data?.has_next && <NextPage key={key} request={request} page={2} render={render} />}
  </>;

  function body() {
    if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
    if (!data || (awaiting_items(resource) && !items.length)) return <ResultsSkeleton />;
    if (!items.length) return data.imports.error ? <CatalogStatus error={data.imports.error} retry={retry} />
      : <EmptyState icon={Search} title={`No results for “${query}”`}>
        <p>{filtered ? 'Change or reset the filters.' : 'Check the spelling or try a shorter title.'}</p>
      </EmptyState>;
    if (compact) return <>
      {featured && <TopResult entry={featured} library={library} compact />}
      <ol className="result-rows">{list}</ol>
    </>;
    return <div className="search-columns">
      {featured && <section aria-labelledby="top-result"><h2 id="top-result" className="search-title">Top result</h2><TopResult entry={featured} library={library} compact={false} /></section>}
      <section aria-labelledby="result-grid"><h2 id="result-grid" className="search-title">{GRID_TITLES[filters.kind]}</h2><ul className="result-grid">{list}</ul></section>
    </div>;
  }

  return <div className="search-results" aria-busy={resource.status === 'loading' || undefined}>
    <FilterBar filters={filters} defaults={SEARCH_DEFAULTS} sorts={SEARCH_SORTS} genres={data?.genres ?? []}
      total={resource.status === 'ready' ? resource.data.total : null} compact={compact} on_change={on_change} />
    {body()}
  </div>;
}

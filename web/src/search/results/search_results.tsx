import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { awaiting_items, use_catalog } from '../../catalog/api';
import { Card } from '../../catalog/components/card';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogEntry, CatalogKind, CatalogPage, CatalogSort } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { EmptyState } from '../../ui/empty_state';
import { FilterBar } from '../filters/filter_bar';
import { active_filters, type FilterChange, type TitleFilters } from '../filters/title_filters';
import { ResultList } from './result_list';
import { ResultRow } from './result_row';
import { ResultsSkeleton } from './results_skeleton';
import { TopResult } from './top_result';

export const SEARCH_SORTS: readonly CatalogSort[] = ['relevance', 'top_rated', 'newest', 'title'];
export const SEARCH_DEFAULTS: TitleFilters = { kind: 'all', sort: 'relevance', genre: '', hide: [] };

const GRID_TITLES: Record<CatalogKind, string> = { all: 'Movies & shows', movie: 'Movies', series: 'Series', anime: 'Anime' };

type Props = { query: string; filters: TitleFilters; compact: boolean; library: Library; on_change: FilterChange };

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
  const filtered = filters.kind !== SEARCH_DEFAULTS.kind || active_filters(filters, SEARCH_DEFAULTS) > 0;

  const render = compact
    ? (entry: CatalogEntry) => <ResultRow key={entry.id} entry={entry} query={query} library={library} />
    : (entry: CatalogEntry) => <Card key={entry.id} entry={entry} library={library} />;
  const list = <ResultList key={JSON.stringify(request)} className={compact ? 'result-rows' : 'title-grid result-grid'} entries={rest}
    has_next={data?.has_next ?? false} request={request} render={render} />;

  function body() {
    if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
    if (!data || (awaiting_items(resource) && !items.length)) return <ResultsSkeleton />;
    if (!items.length) return data.imports.error ? <CatalogStatus error={data.imports.error} retry={retry} />
      : <EmptyState icon={Search} title={`No results for “${query}”`}>
        <p>{filtered ? 'Change or reset the filters.' : 'Check the spelling or try a shorter title.'}</p>
        {filtered && <button className="button secondary" onClick={() => on_change(SEARCH_DEFAULTS)}><X />Reset filters</button>}
      </EmptyState>;
    if (compact) return <>
      {featured && <TopResult entry={featured} library={library} compact />}
      {list}
    </>;
    return <div className="search-columns">
      {featured && <section aria-labelledby="top-result"><h2 id="top-result" className="search-title">Top result</h2>
        <TopResult entry={featured} library={library} compact={false} /></section>}
      <section aria-labelledby="result-grid"><h2 id="result-grid" className="search-title">{GRID_TITLES[filters.kind]}</h2>{list}</section>
    </div>;
  }

  return <div className="search-results" aria-busy={resource.status === 'loading' || undefined}>
    <FilterBar filters={filters} defaults={SEARCH_DEFAULTS} sorts={SEARCH_SORTS} genres={data?.genres ?? []}
      total={resource.status === 'ready' ? resource.data.total : null} compact={compact} on_change={on_change} />
    {body()}
  </div>;
}

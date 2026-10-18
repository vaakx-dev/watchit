import { useState } from 'react';
import type { Library } from '../library/use_library';
import { COMPACT_QUERY, use_media_query } from '../ui/use_media_query';
import type { TitleFilters } from './filters/title_filters';
import { SearchHome } from './home/search_home';
import { remember_search } from './recent/api';
import { SEARCH_DEFAULTS, SearchResults } from './results/search_results';
import './search.css';

const OPENS_TITLE = 'a[href^="#/title/"], a[href^="#/watch/"]';

export function SearchPage({ query, library }: { query: string; library: Library }) {
  const [filters, set_filters] = useState(SEARCH_DEFAULTS);
  const compact = use_media_query(COMPACT_QUERY);
  const text = query.trim();

  return <section className="search-page page-gutter" aria-label="Search"
    onClickCapture={event => {
      if (text && event.target instanceof Element && event.target.closest(OPENS_TITLE)) void remember_search(text);
    }}>
    {text ? <SearchResults query={text} filters={filters} compact={compact} library={library}
      on_change={next => set_filters(current => ({ ...current, ...next } satisfies TitleFilters))} />
      : <SearchHome />}
  </section>;
}

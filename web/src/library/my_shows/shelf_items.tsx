import { CardSkeleton } from '../../catalog/components/skeleton';
import { NearEnd } from '../../ui/near_end';
import { PageRetry } from '../../ui/page_retry';
import type { LibraryItem, LibraryQuery, Shelf } from '../types';
import type { Library } from '../use_library';
import { use_library_titles } from '../use_library_titles';
import { LibraryCard } from './library_card';
import { LibraryRow } from './library_row';
import type { View } from './shelves';

const LOADING_COUNT = 6;

function RowSkeleton() {
  return <div className="myshows-row" aria-hidden="true">
    <div className="myshows-poster skeleton-block" /><div className="myshows-copy"><span className="skeleton-line" /><span className="skeleton-line" /></div>
  </div>;
}

export function Loading({ view }: { view: View }) {
  return Array.from({ length: LOADING_COUNT }, (_, index) => view === 'grid' ? <CardSkeleton key={index} /> : <RowSkeleton key={index} />);
}

export function ShelfItems({ items, shelf, view, library }: { items: readonly LibraryItem[]; shelf: Shelf; view: View; library: Library }) {
  return items.map(item => view === 'grid'
    ? <LibraryCard key={item.title.id} item={item} shelf={shelf} library={library} />
    : <LibraryRow key={item.title.id} item={item} shelf={shelf} library={library} />);
}

export function NextShelfPage({ query, view, last, library, on_more }: {
  query: LibraryQuery;
  view: View;
  last: boolean;
  library: Library;
  on_more: () => void;
}) {
  const { resource, retry } = use_library_titles(query, library);
  if (resource.status === 'error') return <PageRetry error={resource.error} retry={retry} />;
  if (resource.status !== 'ready') return <Loading view={view} />;
  return <>
    <ShelfItems items={resource.data.items} shelf={query.shelf} view={view} library={library} />
    {last && resource.data.has_next && <NearEnd on_reach={on_more} />}
  </>;
}

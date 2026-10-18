import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GridSkeleton } from '../../catalog/components/skeleton';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogKind } from '../../catalog/types';
import { discover_route } from '../../navigation/route';
import { scroll_to_top } from '../../navigation/scroll';
import { EmptyState } from '../../ui/empty_state';
import { plural } from '../pages/kinds';
import type { LibraryPage, LibrarySort, Shelf } from '../types';
import type { Library } from '../use_library';
import { use_library_titles } from '../use_library_titles';
import { LibraryCard } from './library_card';
import { LibraryRow } from './library_row';
import { ShelfPills } from './shelf_pills';
import { SHELF_LABELS, default_sort, default_view, type View } from './shelves';
import { Tools } from './tools';
import './my_shows.css';

const PAGE_SIZE = 24;

const EMPTY: Record<Shelf, { title: string; next: string }> = {
  want: { title: 'Nothing in Want', next: 'Choose Want from a title’s eye menu to line it up for later.' },
  watching: { title: 'Not watching anything', next: 'Choose Watching from a title’s eye menu and it shows here with the next episode.' },
  paused: { title: 'Nothing paused', next: 'Pause a show from its eye menu to come back to it later.' },
  watched: { title: 'Nothing watched yet', next: 'Mark titles Watched from their eye menu, then rate them to build your Rankings.' },
  dropped: { title: 'Nothing dropped', next: 'Titles you give up on land here. Choose Dropped from a title’s eye menu.' },
  favorite: { title: 'No favourites yet', next: 'Open a title’s eye menu and choose Favourite.' },
  recommended: { title: 'Nothing recommended yet', next: 'Open a title’s eye menu and choose Recommended.' },
  saved: { title: 'Nothing saved', next: 'Save a title from its page to keep it here.' },
  recent: { title: 'Nothing opened yet', next: 'Titles appear here when you open a player. Opening one does not mark it watched.' },
};

function Empty({ shelf, kind, show_all }: { shelf: Shelf; kind: CatalogKind; show_all: () => void }) {
  if (kind !== 'all') return <EmptyState title={`No ${plural(kind)} in ${SHELF_LABELS[shelf]}`}>
    <p>Other types may be here. Show every type to check.</p>
    <button type="button" className="button secondary" onClick={show_all}>Show all types</button>
  </EmptyState>;
  return <EmptyState title={EMPTY[shelf].title}>
    <p>{EMPTY[shelf].next}</p>
    <a className="button primary" href={discover_route('all')}>Find something to watch</a>
  </EmptyState>;
}

function ListSkeleton() {
  return <div role="status" aria-label="Loading titles">
    <ul className="myshows-list" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <li className="myshows-row" key={index}>
      <div className="myshows-poster skeleton-block" /><div className="myshows-copy"><span className="skeleton-line" /><span className="skeleton-line" /></div>
    </li>)}</ul>
  </div>;
}

function Titles({ data, shelf, view, library }: { data: LibraryPage; shelf: Shelf; view: View; library: Library }) {
  if (view === 'grid') return <ul className="myshows-grid">
    {data.items.map(item => <LibraryCard key={item.title.id} item={item} shelf={shelf} library={library} />)}
  </ul>;
  return <ul className="myshows-list">{data.items.map(item => <LibraryRow key={item.title.id} item={item} shelf={shelf} library={library} />)}</ul>;
}

function fresh(shelf: Shelf) {
  return { shelf, sort: default_sort(shelf), page: 1 };
}

export function MyShows({ shelf, library }: { shelf: Shelf; library: Library }) {
  const [kind, set_kind] = useState<CatalogKind>('all');
  const [views, set_views] = useState<Partial<Record<Shelf, View>>>({});
  const [browse, set_browse] = useState(() => fresh(shelf));
  const current = browse.shelf === shelf ? browse : fresh(shelf);
  const view = views[shelf] ?? default_view(shelf);
  const { resource, retry } = use_library_titles({ shelf, kind, sort: current.sort, page: current.page }, library);
  const data = resource.status === 'ready' ? resource.data : undefined;
  const [counts, set_counts] = useState(data?.counts);
  if (data && data.counts !== counts) set_counts(data.counts);

  function change_kind(next: CatalogKind) {
    set_kind(next);
    set_browse({ ...current, page: 1 });
  }

  function change_sort(sort: LibrarySort) {
    set_browse({ ...current, sort, page: 1 });
  }

  function change_page(page: number) {
    set_browse({ ...current, page });
    scroll_to_top();
  }

  return <section className="myshows page-gutter" aria-labelledby="page-title">
    <h1 className="sr-only" id="page-title">My shows</h1>
    <ShelfPills shelf={shelf} counts={counts} />
    <Tools kind={kind} sort={current.sort} view={view} on_kind={change_kind} on_sort={change_sort}
      on_view={next => set_views({ ...views, [shelf]: next })} />
    <div className="myshows-body">
      {resource.status === 'error' && <CatalogStatus error={resource.error} retry={retry} />}
      {resource.status !== 'error' && !data && (view === 'grid' ? <GridSkeleton /> : <ListSkeleton />)}
      {data && (data.items.length
        ? <Titles data={data} shelf={shelf} view={view} library={library} />
        : <Empty shelf={shelf} kind={kind} show_all={() => change_kind('all')} />)}
      {data && (current.page > 1 || data.has_next) && <nav className="pagination" aria-label={`${SHELF_LABELS[shelf]} pages`}>
        <button className="button secondary" disabled={current.page === 1} onClick={() => change_page(current.page - 1)}><ChevronLeft />Previous</button>
        <span aria-live="polite">Page {data.page} of {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}</span>
        <button className="button secondary" disabled={!data.has_next} onClick={() => change_page(current.page + 1)}>Next<ChevronRight /></button>
      </nav>}
    </div>
  </section>;
}

import { useState } from 'react';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogKind } from '../../catalog/types';
import { discover_route } from '../../navigation/route';
import { EmptyState } from '../../ui/empty_state';
import { NearEnd } from '../../ui/near_end';
import { plural } from '../pages/kinds';
import type { LibraryPage, LibraryQuery, LibrarySort, Shelf } from '../types';
import type { Library } from '../use_library';
import { use_library_titles } from '../use_library_titles';
import { ShelfPills } from './shelf_pills';
import { Loading, NextShelfPage, ShelfItems } from './shelf_items';
import { SHELF_LABELS, default_sort, default_view, type View } from './shelves';
import { Tools } from './tools';
import './my_shows.css';

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

function Results({ first, query, view, library, show_all }: {
  first: LibraryPage | undefined;
  query: Omit<LibraryQuery, 'page'>;
  view: View;
  library: Library;
  show_all: () => void;
}) {
  const [pages, set_pages] = useState(1);
  const more = () => set_pages(count => count + 1);
  const className = view === 'grid' ? 'myshows-grid' : 'myshows-list';
  if (!first) return <div className={className} role="status" aria-label="Loading titles"><Loading view={view} /></div>;
  if (!first.items.length) return <Empty shelf={query.shelf} kind={query.kind} show_all={show_all} />;

  return <div className={className}>
    <ShelfItems items={first.items} shelf={query.shelf} view={view} library={library} />
    {pages === 1 && first.has_next && <NearEnd on_reach={more} />}
    {Array.from({ length: pages - 1 }, (_, index) => <NextShelfPage key={index + 2} query={{ ...query, page: index + 2 }}
      view={view} last={index + 2 === pages} library={library} on_more={more} />)}
  </div>;
}

export function MyShows({ shelf, library }: { shelf: Shelf; library: Library }) {
  const [kind, set_kind] = useState<CatalogKind>('all');
  const [sorts, set_sorts] = useState<Partial<Record<Shelf, LibrarySort>>>({});
  const [views, set_views] = useState<Partial<Record<Shelf, View>>>({});
  const sort = sorts[shelf] ?? default_sort(shelf);
  const view = views[shelf] ?? default_view(shelf);
  const query = { shelf, kind, sort };
  const { resource, retry } = use_library_titles({ ...query, page: 1 }, library);
  const first = resource.status === 'ready' ? resource.data : undefined;
  const [counts, set_counts] = useState(first?.counts);
  if (first && first.counts !== counts) set_counts(first.counts);

  return <section className="myshows page-gutter" aria-labelledby="page-title">
    <h1 className="sr-only" id="page-title">My shows</h1>
    <ShelfPills shelf={shelf} counts={counts} />
    <Tools kind={kind} sort={sort} sort_set={sort !== default_sort(shelf)} view={view} on_kind={set_kind}
      on_sort={next => set_sorts({ ...sorts, [shelf]: next })}
      on_view={next => set_views({ ...views, [shelf]: next })} />
    <div className="myshows-body">
      {resource.status === 'error'
        ? <CatalogStatus error={resource.error} retry={retry} />
        : <Results key={`${shelf}:${kind}:${sort}`} first={first} query={query} view={view} library={library} show_all={() => set_kind('all')} />}
    </div>
  </section>;
}

import { useState } from 'react';
import { Choices, type Choice } from '../../ui/choices';
import { EmptyState } from '../../ui/empty_state';
import { Icon } from '../../ui/icon';
import { Page } from '../../ui/page';
import { TitleGrid } from '../../catalog/components/title_grid';
import { GridSkeleton } from '../../catalog/components/skeleton';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogKind } from '../../catalog/types';
import { discover_route, mine_route } from '../../navigation/route';
import { RANKINGS } from '../../shell/destinations';
import { StatusEye } from '../components/eye';
import { LIBRARY_SORTS, type LibraryPage, type LibrarySort, type Shelf } from '../types';
import type { Library } from '../use_library';
import { use_library_titles } from '../use_library_titles';
import { KINDS, plural } from './kinds';
import { LibraryRow } from './library_row';

type View = 'list' | 'grid';

const PAGE_SIZE = 24;

const LABELS: Record<Shelf, string> = {
  want: 'Want',
  watching: 'Watching',
  paused: 'Paused',
  watched: 'Watched',
  dropped: 'Dropped',
  favorite: 'Favourites',
  recommended: 'Recommended',
  saved: 'Saved',
  recent: 'Recently opened',
};

const ORDER: readonly Shelf[] = ['watching', 'want', 'paused', 'watched', 'dropped', 'favorite', 'recommended', 'saved', 'recent'];

const SORT_LABELS: Record<LibrarySort, string> = {
  recent: 'Last opened',
  title: 'Title A–Z',
  newest: 'Year',
  rating: 'Your rating',
};

const VIEWS: readonly Choice<View>[] = [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }];

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

function default_sort(shelf: Shelf): LibrarySort {
  return shelf === 'watched' ? 'rating' : 'recent';
}

function shelf_icon(shelf: Shelf) {
  if (shelf === 'favorite') return <StatusEye status={null} favorite />;
  if (shelf === 'recommended') return <StatusEye status={null} recommended />;
  if (shelf === 'saved') return <Icon name="nav-lists" size={18} />;
  if (shelf === 'recent') return undefined;
  return <StatusEye status={shelf} />;
}

function Empty({ shelf, kind, show_all }: { shelf: Shelf; kind: CatalogKind; show_all: () => void }) {
  if (kind !== 'all') return <EmptyState title={`No ${plural(kind)} in ${LABELS[shelf]}`}>
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
    <ul className="library-list" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <li className="library-row" key={index}>
      <div className="library-poster skeleton-block" /><div className="library-copy"><span className="skeleton-line" /><span className="skeleton-line" /></div>
    </li>)}</ul>
  </div>;
}

function Titles({ data, view, library }: { data: LibraryPage; view: View; library: Library }) {
  if (view === 'grid') return <TitleGrid entries={data.items.map(item => item.title)} library={library} />;
  return <ul className="library-list">{data.items.map(item => <LibraryRow key={item.title.id} item={item} library={library} />)}</ul>;
}

export function MyShows({ shelf, library }: { shelf: Shelf; library: Library }) {
  const [kind, set_kind] = useState<CatalogKind>('all');
  const [view, set_view] = useState<View>('list');
  const [browse, set_browse] = useState({ shelf, sort: default_sort(shelf), page: 1 });
  const current = browse.shelf === shelf ? browse : { shelf, sort: default_sort(shelf), page: 1 };
  const { resource, retry } = use_library_titles({ shelf, kind, sort: current.sort, page: current.page }, library);
  const data = resource.status === 'ready' ? resource.data : undefined;
  const [counts, set_counts] = useState(data?.counts);
  if (data && data.counts !== counts) set_counts(data.counts);

  const tabs: Choice<Shelf>[] = ORDER.map(value => ({
    value, label: LABELS[value], icon: shelf_icon(value), count: counts?.[value],
    status: value === 'saved' || value === 'recent' ? undefined : value,
  }));

  function change_kind(next: CatalogKind) {
    set_kind(next);
    set_browse({ ...current, page: 1 });
  }

  function change_page(page: number) {
    set_browse({ ...current, page });
    window.scrollTo(0, 0);
  }

  return <Page title="My shows">
    <Choices look="tabs" label="Watch status" options={tabs} value={shelf} on_change={next => { window.location.hash = mine_route(next); }} />
    <div className="library-toolbar">
      <Choices label="Type" look="segmented" options={KINDS} value={kind} on_change={change_kind} />
      <label className="library-sort">Sort
        <select value={current.sort} onChange={event => set_browse({ ...current, sort: LIBRARY_SORTS.find(sort => sort === event.target.value) ?? current.sort, page: 1 })}>
          {LIBRARY_SORTS.map(sort => <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>)}
        </select>
      </label>
      <Choices look="segmented" label="Layout" options={VIEWS} value={view} on_change={set_view} />
      {shelf === 'watched' && <a className="library-rankings" href={RANKINGS.href}>Your rankings <span aria-hidden="true">→</span></a>}
    </div>
    <div className="library-body">
      {resource.status === 'error' && <CatalogStatus error={resource.error} retry={retry} />}
      {resource.status !== 'error' && !data && (view === 'grid' ? <GridSkeleton /> : <ListSkeleton />)}
      {data && (data.items.length ? <Titles data={data} view={view} library={library} /> : <Empty shelf={shelf} kind={kind} show_all={() => change_kind('all')} />)}
      {data && (current.page > 1 || data.has_next) && <nav className="pagination" aria-label={`${LABELS[shelf]} pages`}>
        <button className="button secondary" disabled={current.page === 1} onClick={() => change_page(current.page - 1)}><Icon name="chevron" className="previous" />Previous</button>
        <span aria-live="polite">Page {data.page} of {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}</span>
        <button className="button secondary" disabled={!data.has_next} onClick={() => change_page(current.page + 1)}>Next<Icon name="chevron" /></button>
      </nav>}
    </div>
  </Page>;
}

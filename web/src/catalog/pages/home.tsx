import { Card } from '../components/card';
import { RankedCard } from '../components/ranked_card';
import { Shelf } from '../components/shelf';
import { ShelfSkeleton } from '../components/skeleton';
import { CatalogStatus } from '../components/status';
import { awaiting_items } from '../api';
import { use_trending } from '../use_trending';
import { discover_route, mine_route } from '../../navigation/route';
import { use_library_titles } from '../../library/use_library_titles';
import type { Library } from '../../library/use_library';
import { ContinueRow } from './home_continue';
import { TrendingHero } from './home_hero';

const TRENDING_COUNT = 10;
const WANT_QUERY = { shelf: 'want', kind: 'all', sort: 'recent', page: 1 } as const;

function TrendingRow({ library }: { library: Library }) {
  const { resource, retry } = use_trending({});
  if (awaiting_items(resource)) return <ShelfSkeleton title="Trending now" />;
  if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
  if (resource.status !== 'ready' || !resource.data.items.length) return null;

  return <Shelf title="Trending now" link={{ href: discover_route('all'), label: 'All trending' }}>
    {resource.data.items.slice(0, TRENDING_COUNT).map((entry, index) => <RankedCard rank={index + 1} entry={entry} key={entry.id} library={library} />)}
  </Shelf>;
}

function WantRow({ library }: { library: Library }) {
  const { resource, retry } = use_library_titles(WANT_QUERY, library);
  if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
  if (resource.status !== 'ready' || !resource.data.items.length) return null;
  const { items, total } = resource.data;

  return <Shelf title="Want to watch" link={{ href: mine_route('want'), label: total === 1 ? '1 title' : `${total} titles` }}>
    {items.map(item => <Card entry={item.title} key={item.title.id} library={library} />)}
  </Shelf>;
}

export function Home({ library }: { library: Library }) {
  return <>
    <TrendingHero library={library} />
    <div className="home-shelves page-gutter">
      <ContinueRow library={library} />
      <TrendingRow library={library} />
      <WantRow library={library} />
    </div>
  </>;
}

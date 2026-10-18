import { RecentSearchList } from '../recent/recent_searches';
import { GenreTiles } from './genre_tiles';
import { TrendingPosters } from './trending_posters';

export function SearchHome() {
  return <div className="search-home">
    <RecentSearchList />
    <TrendingPosters />
    <GenreTiles />
  </div>;
}

import type { EpisodeNavigation } from '../types';

export function EpisodePages({ navigation, select_page }: { navigation: EpisodeNavigation; select_page: (page: number) => void }) {
  if (navigation.page === 1 && !navigation.has_next) return null;
  return <nav className="pagination" aria-label="Episode pages">
    <button className="button secondary small" disabled={navigation.page === 1} onClick={() => select_page(navigation.page - 1)}>Previous</button>
    <span>Page {navigation.page}</span>
    <button className="button secondary small" disabled={!navigation.has_next} onClick={() => select_page(navigation.page + 1)}>Next</button>
  </nav>;
}

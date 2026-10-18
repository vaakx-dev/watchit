import { Clock, X } from 'lucide-react';
import { search_route } from '../../navigation/route';
import { clear_searches, forget_search } from './api';
import { use_recent_searches } from './use_recent_searches';

export function RecentSearchList() {
  const searches = use_recent_searches();
  if (!searches?.length) return null;

  return <section className="search-section" aria-labelledby="recent-searches">
    <div className="search-heading">
      <h2 id="recent-searches">Recent</h2>
      <button type="button" onClick={() => { void clear_searches(); }}>Clear all</button>
    </div>
    <ul className="recent-searches">
      {searches.map(search => <li key={search}>
        <a href={search_route(search)} onClick={event => { event.preventDefault(); window.location.replace(search_route(search)); }}>
          <Clock aria-hidden="true" /><span>{search}</span>
        </a>
        <button type="button" className="icon-button ghost small" aria-label={`Remove ${search} from recent searches`}
          onClick={() => { void forget_search(search); }}><X /></button>
      </li>)}
    </ul>
  </section>;
}

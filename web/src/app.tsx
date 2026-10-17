import { useEffect, useRef } from 'react';
import { Collection } from './catalog/pages/collection';
import { TitlePage, TitleSkeleton } from './catalog/pages/title';
import { Home } from './catalog/pages/home';
import { CatalogStatus } from './catalog/components/status';
import { use_title } from './catalog/api';
import { Settings } from './cache/settings';
import { MyShows } from './library/pages/my_shows';
import { Rankings } from './library/pages/rankings';
import { use_library } from './library/use_library';
import { use_library_refresh } from './library/use_library_refresh';
import { use_route } from './navigation/route';
import { Player } from './playback/player';
import { ProfilePicker } from './profiles/profile_picker';
import type { Profile } from './profiles/types';
import { Header } from './shell/header';
import { TabBar } from './shell/tab_bar';
import { EmptyState } from './ui/empty_state';

type Props = { profile: Profile; profiles: Profile[]; on_profiles_changed: () => void };

export function App({ profile, profiles, on_profiles_changed }: Props) {
  const route = use_route();
  const library = use_library();
  const main = useRef<HTMLElement>(null);
  const { resource, retry } = use_title('id' in route ? route.id : undefined);
  use_library_refresh(library, retry);
  const result = resource.status === 'ready' ? resource.data : undefined;
  const title = result?.title;
  const name = title?.title;
  const route_key = 'id' in route ? `${route.view}/${route.id}` : route.view === 'search' ? `search:${route.query}` : route.view;
  const empty_search = route.view === 'search' && !route.query;

  useEffect(() => {
    window.scrollTo(0, 0);
    const target = empty_search ? document.getElementById('search-input') : main.current;
    target?.focus({ preventScroll: true });
  }, [route_key, empty_search]);

  useEffect(() => {
    document.title = name ? `${name} | Watchit` : 'Watchit';
  }, [name]);

  return <>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>
    <Header route={route} profile={profile} />
    <main id="main-content" ref={main} tabIndex={-1}>
      {library.error && <div className="library-notice" role="alert"><p>Your library request failed: {library.error} Changes are not confirmed until the server saves them.</p><button className="button secondary small" disabled={library.pending || library.loading} onClick={library.retry}>Reload library</button></div>}
      {route.view === 'tonight' && <Home library={library} />}
      {(route.view === 'discover' || route.view === 'search') && <Collection key={route_key} route={route} library={library} />}
      {route.view === 'mine' && <MyShows shelf={route.shelf} library={library} />}
      {route.view === 'rankings' && <Rankings />}
      {(route.view === 'title' || (route.view === 'watch' && title?.kind === 'series')) && result && <TitlePage key={result.title.id} result={result} library={library} />}
      {route.view === 'watch' && result && result.title.kind !== 'series' && <Player key={result.title.id} title={result.title} remembered_source={result.playback_source} library={library} />}
      {'id' in route && !title && (route.view === 'title' && resource.status !== 'error'
        ? <TitleSkeleton /> : <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} />)}
      {route.view === 'settings' && <Settings />}
      {route.view === 'profiles' && <div className="page-gutter"><ProfilePicker profiles={profiles} current={profile} on_changed={on_profiles_changed} /></div>}
      {route.view === 'missing' && <div className="not-found"><EmptyState title="That page is not in the catalog."><a className="button primary" href="#/">Back to Tonight</a></EmptyState></div>}
    </main>
    <TabBar route={route} />
  </>;
}

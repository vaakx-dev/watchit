import { Icon } from '../ui/icon';
import type { Route } from '../navigation/route';
import { ProfileAvatar } from '../profiles/avatar';
import type { Profile } from '../profiles/types';
import { Brand } from './brand';
import { DISCOVER, DOWNLOADS, MINE, RANKINGS, TONIGHT } from './destinations';
import { SearchField } from './search_field';

export function Header({ route, profile }: { route: Route; profile: Profile }) {
  const searching = route.view === 'search';
  return (
    <header className={`top-bar page-gutter${searching ? ' searching' : ''}`}>
      <a href="#/" aria-label="Watchit, Tonight"><Brand /></a>
      <nav aria-label="Main navigation">
        {[TONIGHT, DISCOVER, MINE, RANKINGS, DOWNLOADS].map(item => <a key={item.view} href={item.href}
          aria-current={route.view === item.view ? 'page' : undefined}>{item.label}</a>)}
      </nav>
      <SearchField query={searching ? route.query : null} />
      <a className="icon-button ghost" href="#/settings" aria-label="Settings" title="Settings"
        aria-current={route.view === 'settings' ? 'page' : undefined}><Icon name="settings" /></a>
      <a className="profile-link" href="#/profiles" aria-label={`Switch profile (${profile.name})`} title={`Switch profile (${profile.name})`}
        aria-current={route.view === 'profiles' ? 'page' : undefined}><ProfileAvatar profile={profile} /></a>
    </header>
  );
}

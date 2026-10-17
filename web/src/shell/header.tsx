import { Settings } from 'lucide-react';
import type { Route } from '../navigation/route';
import { ProfileAvatar } from '../profiles/avatar';
import type { Profile } from '../profiles/types';
import { framed } from '../title_bar/frame';
import { open_system_menu } from '../title_bar/system_menu';
import { WindowControls } from '../title_bar/window_controls';
import { HistoryButtons } from './history_buttons';
import { Brand } from './brand';
import { DISCOVER, DOWNLOADS, MINE, RANKINGS, TONIGHT } from './destinations';
import { SearchField } from './search_field';

export function Header({ route, profile }: { route: Route; profile: Profile }) {
  const searching = route.view === 'search';
  return (
    <header className={`top-bar page-gutter${searching ? ' searching' : ''}`} data-tauri-drag-region={framed ? 'deep' : undefined} onContextMenu={framed ? open_system_menu : undefined}>
      {framed && <HistoryButtons />}
      <a href="#/" aria-label="Watchit, Tonight"><Brand /></a>
      <nav aria-label="Main navigation">
        {[TONIGHT, DISCOVER, MINE, RANKINGS, DOWNLOADS].map(item => <a key={item.view} href={item.href}
          aria-current={route.view === item.view ? 'page' : undefined}>{item.label}</a>)}
      </nav>
      <SearchField query={searching ? route.query : null} />
      <a className="icon-button ghost" href="#/settings" aria-label="Settings" title="Settings"
        aria-current={route.view === 'settings' ? 'page' : undefined}><Settings /></a>
      <a className="profile-link" href="#/profiles" aria-label={`Switch profile (${profile.name})`} title={`Switch profile (${profile.name})`}
        aria-current={route.view === 'profiles' ? 'page' : undefined}><ProfileAvatar profile={profile} /></a>
      {framed && <WindowControls />}
    </header>
  );
}

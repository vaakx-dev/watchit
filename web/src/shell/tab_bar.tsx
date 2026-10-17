import { Icon } from '../ui/icon';
import type { Route } from '../navigation/route';
import { DISCOVER, DOWNLOADS, MINE, RANKINGS, SEARCH, TONIGHT } from './destinations';

export function TabBar({ route }: { route: Route }) {
  return <nav className="tab-bar" aria-label="Main navigation">
    {[TONIGHT, DISCOVER, SEARCH, MINE, RANKINGS, DOWNLOADS].map(item => <a key={item.view} href={item.href}
      aria-current={route.view === item.view ? 'page' : undefined}><Icon name={item.icon} size={21} />{item.label}</a>)}
  </nav>;
}

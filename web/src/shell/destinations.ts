import type { IconName } from '../ui/icon';
import type { Route } from '../navigation/route';

export type Destination = { view: Route['view']; href: string; label: string; icon: IconName };

export const TONIGHT: Destination = { view: 'tonight', href: '#/', label: 'Tonight', icon: 'nav-home' };
export const DISCOVER: Destination = { view: 'discover', href: '#/discover', label: 'Discover', icon: 'nav-browse' };
export const SEARCH: Destination = { view: 'search', href: '#/search', label: 'Search', icon: 'search' };
export const MINE: Destination = { view: 'mine', href: '#/mine', label: 'My shows', icon: 'nav-lists' };
export const RANKINGS: Destination = { view: 'rankings', href: '#/rankings', label: 'Rankings', icon: 'nav-rankings' };
export const DOWNLOADS: Destination = { view: 'downloads', href: '#/downloads', label: 'Downloads', icon: 'downloads' };

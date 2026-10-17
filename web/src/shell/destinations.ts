import { Bookmark, Compass, Download, House, Search, Trophy, type LucideIcon } from 'lucide-react';
import type { Route } from '../navigation/route';

export type Destination = { view: Route['view']; href: string; label: string; icon: LucideIcon };

export const TONIGHT: Destination = { view: 'tonight', href: '#/', label: 'Tonight', icon: House };
export const DISCOVER: Destination = { view: 'discover', href: '#/discover', label: 'Discover', icon: Compass };
export const SEARCH: Destination = { view: 'search', href: '#/search', label: 'Search', icon: Search };
export const MINE: Destination = { view: 'mine', href: '#/mine', label: 'My shows', icon: Bookmark };
export const RANKINGS: Destination = { view: 'rankings', href: '#/rankings', label: 'Rankings', icon: Trophy };
export const DOWNLOADS: Destination = { view: 'downloads', href: '#/downloads', label: 'Downloads', icon: Download };

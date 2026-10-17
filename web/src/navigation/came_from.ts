import { parse_route } from './route';

type Entry = { came_from?: string };

const LABELS: Partial<Record<ReturnType<typeof parse_route>['view'], string>> = {
  tonight: 'Tonight',
  discover: 'Discover',
  search: 'Search',
  mine: 'My shows',
  rankings: 'Rankings',
  downloads: 'Downloads',
};

window.addEventListener('hashchange', event => {
  const entry = window.history.state as Entry | null;
  if (entry?.came_from !== undefined) return;
  window.history.replaceState({ ...entry, came_from: new URL(event.oldURL).hash || '#/' }, '');
});

export function came_from() {
  const hash = (window.history.state as Entry | null)?.came_from;
  if (hash === undefined) return undefined;
  return { label: LABELS[parse_route(hash).view] ?? 'Back' };
}

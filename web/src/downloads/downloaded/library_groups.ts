import type { Transfer } from '../../torrents/types';
import { episode_ids, episode_number, series_id } from '../titles';

export type EpisodeCopy = { id: string; season: number; episode: number; name: string; size: number; transfer: Transfer; pack: boolean };
type SeasonShelf = { season: number; episodes: EpisodeCopy[] };
export type ShowGroup = { id: string; seasons: SeasonShelf[]; episodes: number; size: number; transfers: Transfer[] };
export type LibraryItem = { kind: 'movie'; transfer: Transfer; added: number } | { kind: 'show'; show: ShowGroup; added: number };

function copies(transfer: Transfer): EpisodeCopy[] {
  const ids = episode_ids(transfer);
  return ids.map(id => {
    const files = transfer.files.filter(file => file.title_id === id);
    const size = files.length ? files.reduce((total, file) => total + file.size_bytes, 0) : transfer.size_bytes;
    return { id, ...episode_number(id), name: files[0]?.name ?? transfer.name, size, transfer, pack: ids.length > 1 };
  });
}

function shelves(episodes: EpisodeCopy[]): SeasonShelf[] {
  const seasons = new Map<number, EpisodeCopy[]>();
  for (const copy of episodes) seasons.set(copy.season, [...seasons.get(copy.season) ?? [], copy]);
  return [...seasons].sort(([a], [b]) => a - b).map(([season, list]) => ({ season, episodes: list.sort((a, b) => a.episode - b.episode) }));
}

export function show_group(id: string, transfers: Transfer[]): ShowGroup {
  const seasons = shelves(transfers.flatMap(copies));
  return {
    id,
    seasons,
    episodes: seasons.reduce((total, shelf) => total + shelf.episodes.length, 0),
    size: transfers.reduce((total, transfer) => total + transfer.size_bytes, 0),
    transfers,
  };
}

export function shows_by_id(transfers: readonly Transfer[]) {
  const shows = new Map<string, Transfer[]>();
  for (const transfer of transfers) {
    if (!episode_ids(transfer).length) continue;
    const id = series_id(transfer.title_id);
    shows.set(id, [...shows.get(id) ?? [], transfer]);
  }
  return shows;
}

function latest(transfers: readonly Transfer[]) {
  return Math.max(...transfers.map(transfer => transfer.added_at));
}

export function library_items(transfers: readonly Transfer[]): LibraryItem[] {
  const movies: LibraryItem[] = transfers.filter(transfer => !episode_ids(transfer).length)
    .map(transfer => ({ kind: 'movie', transfer, added: transfer.added_at }));
  const shows: LibraryItem[] = [...shows_by_id(transfers)]
    .map(([id, list]) => ({ kind: 'show', show: show_group(id, list), added: latest(list) }));
  return [...movies, ...shows].sort((a, b) => b.added - a.added);
}

import type { Transfer } from '../../torrents/types';
import { episode_ids, episode_number, series_id } from '../titles';

export type EpisodeCopy = { id: string; season: number; episode: number; name: string; size: number; transfer: Transfer; pack: boolean };
export type SeasonShelf = { season: number; episodes: EpisodeCopy[]; packs: Transfer[]; size: number };
export type LibraryGroup = { id: string; movies: Transfer[]; seasons: SeasonShelf[]; size: number; added: number };

function copies(transfer: Transfer): EpisodeCopy[] {
  const ids = episode_ids(transfer);
  return ids.map(id => {
    const files = transfer.files.filter(file => file.title_id === id);
    const size = files.length ? files.reduce((total, file) => total + file.size_bytes, 0) : transfer.size_bytes;
    return { id, ...episode_number(id), name: files[0]?.name ?? transfer.name, size, transfer, pack: ids.length > 1 };
  });
}

function shelves(episodes: EpisodeCopy[]) {
  const seasons = new Map<number, EpisodeCopy[]>();
  for (const copy of episodes) seasons.set(copy.season, [...seasons.get(copy.season) ?? [], copy]);
  return [...seasons].sort(([a], [b]) => a - b).map(([season, list]) => ({
    season,
    episodes: list.sort((a, b) => a.episode - b.episode),
    packs: [...new Set(list.filter(copy => copy.pack).map(copy => copy.transfer))],
    size: list.reduce((total, copy) => total + copy.size, 0),
  }));
}

export function library_groups(transfers: readonly Transfer[]): LibraryGroup[] {
  const by_title = new Map<string, Transfer[]>();
  for (const transfer of transfers) {
    const id = series_id(transfer.title_id);
    by_title.set(id, [...by_title.get(id) ?? [], transfer]);
  }
  return [...by_title].map(([id, list]) => ({
    id,
    movies: list.filter(transfer => !episode_ids(transfer).length),
    seasons: shelves(list.flatMap(copies)),
    size: list.reduce((total, transfer) => total + transfer.size_bytes, 0),
    added: Math.max(...list.map(transfer => transfer.added_at)),
  })).sort((a, b) => b.added - a.added);
}

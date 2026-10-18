import { use_resource } from '../catalog/api';
import type { TitleResult } from '../catalog/types';
import { local_files_url } from '../torrents/api';
import type { LocalFile, Transfer } from '../torrents/types';

export function series_id(title_id: string) {
  return title_id.split(':')[0] ?? title_id;
}

export function episode_ids(transfer: Transfer) {
  const ids = transfer.files.map(file => file.title_id ?? '').filter(id => id.includes(':'));
  if (ids.length) return [...new Set(ids)];
  return transfer.title_id.includes(':') ? [transfer.title_id] : [];
}

export function episode_number(id: string) {
  const [, season, episode] = id.split(':');
  return { season: Number(season), episode: Number(episode) };
}

function episode_label(transfer: Transfer) {
  const ids = episode_ids(transfer);
  const [only] = ids;
  if (!only) return null;
  const seasons = new Set(ids.map(id => episode_number(id).season));
  const [season] = seasons;
  if (ids.length === 1) return `S${season} E${episode_number(only).episode}`;
  return seasons.size === 1 ? `S${season} · ${ids.length} episodes` : `${ids.length} episodes`;
}

export function use_title(id: string) {
  const { resource } = use_resource<TitleResult>(`/api/titles/${encodeURIComponent(id)}`);
  return resource.status === 'ready' ? resource.data.title : null;
}

export function use_transfer_title(transfer: Transfer) {
  const id = series_id(transfer.title_id);
  const title = use_title(id);
  return { id, title, name: title?.title ?? transfer.name, episode: episode_label(transfer) };
}

export function use_quality(transfer: Transfer) {
  const { resource } = use_resource<{ files: LocalFile[] }>(local_files_url(transfer.title_id));
  const file = resource.status === 'ready' ? resource.data.files.find(item => item.info_hash === transfer.info_hash) : undefined;
  if (!file?.resolution) return null;
  return file.hdr.length ? `${file.resolution} HDR` : file.resolution;
}

export function watch_href(title_id: string) {
  return `#/watch/${title_id}`;
}

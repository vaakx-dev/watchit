import { use_resource } from '../../catalog/api';
import type { TorrentSettings } from '../../torrents/types';

export function use_default_folder(series: boolean) {
  const { resource } = use_resource<TorrentSettings>('/api/torrents/settings', { cache: false });
  if (resource.status !== 'ready') return undefined;
  const settings = resource.data;
  return (series ? settings.series_dir : settings.movie_dir) ?? settings.download_dir;
}

import { use_resource } from '../../catalog/api';
import { search_url } from '../../torrents/api';
import { bytes } from '../../torrents/format';
import { resolution_label } from '../../torrents/quality';
import type { TorrentResult, TorrentSearch } from '../../torrents/types';

function hdr_label(hdr: TorrentResult['hdr']) {
  if (hdr.includes('DV')) return 'DV';
  return hdr.length ? 'HDR' : null;
}

function source_label(result: TorrentResult) {
  const quality = [resolution_label(result.resolution), hdr_label(result.hdr)].filter(Boolean).join(' ');
  return [quality, result.size_bytes === null ? null : bytes(result.size_bytes)].filter(Boolean).join(' · ');
}

export function use_best_source(title_id: string | null) {
  const { resource } = use_resource<TorrentSearch>(title_id && search_url(title_id), { cache: false });
  const best = resource.status === 'ready' ? resource.data.results[0] : undefined;
  return best ? source_label(best) : null;
}

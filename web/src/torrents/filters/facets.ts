import { resolution_label } from '../quality';
import type { TorrentResult } from '../types';
import { language_name } from './language_name';

export type FacetKey = 'pack' | 'resolution' | 'hdr' | 'codec' | 'audio' | 'language' | 'site';

export type FacetOption = { value: string; label: string; count: number };

export type Facet = { key: FacetKey; label: string; options: FacetOption[] };

const FACET_LABELS: Record<FacetKey, string> = {
  pack: 'Type',
  resolution: 'Resolution',
  hdr: 'HDR',
  codec: 'Video',
  audio: 'Audio',
  language: 'Language',
  site: 'Site',
};

const FACET_ORDER: readonly FacetKey[] = ['pack', 'resolution', 'hdr', 'codec', 'audio', 'language', 'site'];

const FIXED_ORDER: Partial<Record<FacetKey, readonly string[]>> = {
  pack: ['pack', 'episode'],
  resolution: ['2160p', '1440p', '1080p', '720p', '480p', '360p', 'unknown'],
  hdr: ['DV', 'HDR10+', 'HDR10', 'HLG', 'SDR'],
};

const CHANNELS = /^\d\.\d$/;

function audio_values(audio: string | null) {
  if (!audio) return [];
  const words = audio.split(' ');
  const codec = words.filter(word => !CHANNELS.test(word) && word !== 'Atmos').join(' ');
  return [codec, words.includes('Atmos') && 'Atmos'].filter((value): value is string => Boolean(value));
}

export function facet_values(result: TorrentResult, key: FacetKey): string[] {
  switch (key) {
    case 'pack': return [result.season_pack ? 'pack' : 'episode'];
    case 'resolution': return [result.resolution ?? 'unknown'];
    case 'hdr': return result.hdr.length ? result.hdr : ['SDR'];
    case 'codec': return result.video_codec ? [result.video_codec] : [];
    case 'audio': return audio_values(result.audio);
    case 'language': return result.languages;
    case 'site': return result.site ? [result.site] : [];
  }
}

function option_label(key: FacetKey, value: string) {
  if (key === 'pack') return value === 'pack' ? 'Season packs' : 'Single episodes';
  if (key === 'resolution') return value === 'unknown' ? 'Unknown' : resolution_label(value) ?? value;
  if (key === 'language') return language_name(value);
  return value;
}

function ordered(key: FacetKey, counts: Map<string, number>) {
  const fixed = FIXED_ORDER[key];
  const values = [...counts.keys()];
  if (fixed) return values.sort((a, b) => fixed.indexOf(a) - fixed.indexOf(b));
  return values.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

export function build_facets(results: readonly TorrentResult[], season: boolean): Facet[] {
  return FACET_ORDER.filter(key => season || key !== 'pack').map(key => {
    const counts = new Map<string, number>();
    for (const result of results) for (const value of facet_values(result, key)) counts.set(value, (counts.get(value) ?? 0) + 1);
    const options = ordered(key, counts).map(value => ({ value, label: option_label(key, value), count: counts.get(value) ?? 0 }));
    return { key, label: FACET_LABELS[key], options };
  }).filter(facet => facet.options.length > 1);
}

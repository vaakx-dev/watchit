import { bytes } from './format';
import { language_name } from './filters/language_name';
import type { TorrentResult } from './types';

function seeders(count: number | null) {
  return count === null ? null : `${count.toLocaleString()} ${count === 1 ? 'seeder' : 'seeders'}`;
}

export function result_details(result: TorrentResult) {
  return [
    seeders(result.seeders),
    result.size_bytes !== null && bytes(result.size_bytes),
    result.video_codec,
    result.audio,
    result.site,
    result.languages.map(language_name).join(' / '),
  ];
}

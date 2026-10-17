import { send } from '../../catalog/client';
import type { QualityPreferences } from '../../generated/torrents/QualityPreferences';

export const QUALITY_URL = '/api/torrents/quality';

export function save_quality(quality: QualityPreferences) {
  return send<QualityPreferences>(QUALITY_URL, 'PATCH', quality);
}

export type { QualityPreferences };

import { useState } from 'react';
import { use_resource } from '../../../catalog/api';
import { error_message, send } from '../../../catalog/client';
import { remember } from '../../../cache/responses';
import type { RankingChoice } from '../../../generated/library/RankingChoice';
import type { RankingSystem } from '../../../generated/library/RankingSystem';

export type { RankingSystem };

const URL = '/api/rankings/system';

export function use_ranking_system() {
  const { resource, retry } = use_resource<RankingChoice>(URL);
  const [chosen, set_chosen] = useState<RankingSystem | null>(null);
  const [failure, set_failure] = useState<string | null>(null);
  const system = chosen ?? (resource.status === 'ready' ? resource.data.system : null);
  const error = resource.status === 'error' ? resource.error : undefined;

  async function choose(next: RankingSystem) {
    set_chosen(next);
    set_failure(null);
    try {
      remember(URL, await send<RankingChoice>(URL, 'PUT', { system: next }));
      return true;
    } catch (cause) {
      set_chosen(null);
      set_failure(error_message(cause, 'Could not save.'));
      return false;
    }
  }

  return { system, error, failure, retry, choose };
}

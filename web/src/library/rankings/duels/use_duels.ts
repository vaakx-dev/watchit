import { use_resource } from '../../../catalog/api';
import { send } from '../../../catalog/client';
import type { CatalogKind } from '../../../catalog/types';
import type { Contender } from '../../../generated/library/Contender';
import type { DuelBoard } from '../../../generated/library/DuelBoard';

export type { Contender, DuelBoard };

export function use_duels(kind: CatalogKind) {
  const { resource, retry } = use_resource<DuelBoard>(`/api/rankings/duels?kind=${kind}`, { cache: false });
  const post = (path: string, body?: unknown) => send<DuelBoard>(`/api/rankings/duels${path}?kind=${kind}`, 'POST', body);
  const ids = (pair: readonly Contender[]) => ({ first: pair[0]!.title.id, second: pair[1]!.title.id });

  return {
    resource,
    retry,
    result: (pair: readonly Contender[], winner: string | null) => post('', { ...ids(pair), winner }),
    skip: (pair: readonly Contender[]) => post('/skip', ids(pair)),
    undo: () => post('/undo'),
  };
}

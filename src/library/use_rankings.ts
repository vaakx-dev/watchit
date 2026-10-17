import { useCallback, useEffect, useRef, useState } from 'react';
import { use_resource } from '../catalog/api';
import { request } from '../catalog/client';
import { remember } from '../cache/responses';
import type { CatalogKind } from '../catalog/types';
import { create_queue } from './queue';
import * as moves from './ranking_moves';
import type { Rankings } from './types';

export function use_rankings(kind: CatalogKind) {
  const url = `/api/rankings?kind=${kind}`;
  const { resource, retry } = use_resource<Rankings>(url);
  const [state, set_state] = useState<moves.RankingState>({ confirmed: null, pending: [], error: null });
  const model = useRef(state);
  const queue = useRef(create_queue());
  const sequence = useRef(0);

  const publish = useCallback((next: moves.RankingState) => {
    model.current = next;
    set_state(next);
  }, []);

  useEffect(() => {
    if (resource.status === 'ready') publish(moves.accept(model.current, resource.data));
  }, [resource, publish]);

  const reorder = useCallback((move: moves.Move) => {
    const pending = { ...move, sequence: sequence.current++ };
    publish(moves.enqueue(model.current, pending));
    return queue.current.enqueue(async () => {
      try {
        const data = await request<Rankings>(`/api/rankings/${encodeURIComponent(move.id)}?kind=${kind}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ before: move.before }),
        });
        remember(url, data);
        publish(moves.confirm(model.current, pending.sequence, data));
      } catch (cause: unknown) {
        publish(moves.reject(model.current, pending.sequence, cause instanceof Error ? cause.message : 'The server did not answer.'));
      }
    });
  }, [kind, url, publish]);

  return { rankings: moves.shown(state), resource, retry, error: state.error, reorder };
}

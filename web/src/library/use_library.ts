import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { awaiting_update, poll_delay, use_visible } from '../catalog/api';
import { error_message, HttpError, read, request } from '../catalog/client';
import * as cache from '../cache/responses';
import type { CatalogEntry } from '../catalog/types';
import * as optimism from './optimism';
import { create_queue } from './queue';
import type { LibrarySnapshot, PersonalPatch, Rating } from './types';

const IMPORT_RETRIES = 5;

function request_body(change: optimism.Change) {
  if (change.kind === 'entry') return change.patch;
  if (change.kind === 'season') return { rating: change.rating };
  return { watched: change.watched };
}

async function save(url: string, change: optimism.Change): Promise<LibrarySnapshot> {
  const options = { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request_body(change)) };
  for (let attempt = 1; ; attempt++) {
    try {
      return await request<LibrarySnapshot>(url, options);
    } catch (cause: unknown) {
      const retry_after = cause instanceof HttpError && cause.status === 409 ? cause.retry_after : undefined;
      if (retry_after === undefined || attempt === IMPORT_RETRIES) throw cause;
      await new Promise(resolve => setTimeout(resolve, retry_after * 1000));
    }
  }
}

export function use_library() {
  const [state, set_state] = useState(() => optimism.create(cache.responses.get<LibrarySnapshot>('/api/library')));
  const model = useRef(state);
  const queue = useRef(create_queue());
  const sequence = useRef(0);
  const needs_read = useRef(false);
  const snapshot = useMemo(() => optimism.snapshot(state), [state]);
  const pending = state.pending.length > 0;
  const [ready, set_ready] = useState(() => cache.responses.get('/api/library') !== undefined);
  const [loading, set_loading] = useState(true);
  const [load_error, set_load_error] = useState<string | null>(null);
  const [revision, set_revision] = useState(0);
  const [attempt, set_attempt] = useState(0);
  const visible = use_visible();
  const waiting = !loading && !pending && awaiting_update(snapshot, [...snapshot.saved, ...snapshot.recent]);

  const publish = useCallback((next: optimism.State) => {
    model.current = next;
    set_state(next);
  }, []);

  useEffect(() => {
    const current = model.current.revision;
    const controller = new AbortController();

    void read<LibrarySnapshot>('/api/library', controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (!optimism.can_accept(model.current, current)) {
        needs_read.current = true;
        return;
      }
      needs_read.current = false;
      if (data !== model.current.confirmed) publish(optimism.accept(model.current, data));
      set_ready(true);
      set_load_error(null);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (!optimism.can_accept(model.current, current)) {
        needs_read.current = true;
        return;
      }
      set_load_error(error_message(cause, 'Could not load your library.'));
    }).finally(() => {
      if (!controller.signal.aborted) set_loading(false);
    });

    return () => controller.abort();
  }, [publish, revision, attempt]);

  useEffect(() => {
    if (pending || ready || !needs_read.current) return;
    needs_read.current = false;
    set_loading(true);
    set_revision(value => value + 1);
  }, [loading, pending, ready]);

  useEffect(() => {
    if (!waiting || !visible) return;
    const timer = setTimeout(() => set_attempt(value => value + 1), poll_delay(attempt));
    return () => clearTimeout(timer);
  }, [waiting, visible, attempt]);

  const mutate = useCallback((url: string, change: optimism.Change): Promise<boolean> => {
    const mutation = { ...change, sequence: sequence.current++ };
    publish(optimism.enqueue(model.current, mutation));

    return queue.current.enqueue(async () => {
      try {
        const data = await save(url, mutation);
        cache.remember('/api/library', data);
        publish(optimism.confirm(model.current, mutation.sequence, data));
        needs_read.current = false;
        set_ready(true);
        set_load_error(null);
        return true;
      } catch (cause: unknown) {
        const error = error_message(cause, 'Your change could not be saved.');
        publish(optimism.reject(model.current, mutation.sequence, error));
        return false;
      }
    });
  }, [publish]);

  const update = useCallback((id: string, patch: PersonalPatch) => mutate(
    `/api/library/${encodeURIComponent(id)}`, { kind: 'entry', entry_id: id, patch },
  ), [mutate]);

  const update_season = useCallback((series_id: string, season: number, rating: Rating | null) => mutate(
    `/api/library/${encodeURIComponent(series_id)}/seasons/${season}`, { kind: 'season', series_id, season, rating },
  ), [mutate]);

  const mark_season_watched = useCallback((series_id: string, season: number, episode_ids: readonly string[], watched: boolean) => mutate(
    `/api/library/${encodeURIComponent(series_id)}/seasons/${season}`, { kind: 'season_watched', episode_ids, watched },
  ), [mutate]);

  const remember = useCallback((id: string) => update(id, { opened: true }), [update]);

  const toggle_saved = useCallback((title: CatalogEntry) => {
    const saved = optimism.snapshot(model.current).entries[title.id]?.saved ?? false;
    return mutate(`/api/library/${encodeURIComponent(title.id)}`, {
      kind: 'entry', entry_id: title.id, patch: { saved: !saved }, title,
    });
  }, [mutate]);

  const refresh = useCallback(() => set_revision(value => value + 1), []);

  const retry = useCallback(() => {
    publish({ ...model.current, error: null });
    set_load_error(null);
    set_loading(true);
    set_revision(value => value + 1);
  }, [publish]);

  const error = state.error ?? load_error;
  return useMemo(() => ({
    ...snapshot, ready, loading, pending, error, update, update_season, mark_season_watched, toggle_saved, remember, refresh, retry,
  }), [snapshot, ready, loading, pending, error, update, update_season, mark_season_watched, toggle_saved, remember, refresh, retry]);
}

export type Library = ReturnType<typeof use_library>;

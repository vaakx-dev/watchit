import type { ProfileSession } from './types';

const KEY = 'watchit:session';

type StoredSession = { token: string; profile: number };

function browser_storage() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

function stored_value(): unknown {
  try { return JSON.parse(browser_storage()?.getItem(KEY) ?? 'null'); }
  catch { return null; }
}

function stored_session(): StoredSession | null {
  const value = stored_value();
  if (!value || typeof value !== 'object' || !('token' in value) || typeof value.token !== 'string') return null;
  if (!('profile' in value) || typeof value.profile !== 'number') return null;
  return { token: value.token, profile: value.profile };
}

function reload_home() {
  window.history.replaceState(null, '', '#/');
  window.location.reload();
}

export const active_session = stored_session();

export function start_session({ token, profile }: ProfileSession) {
  browser_storage()?.setItem(KEY, JSON.stringify({ token, profile: profile.id }));
  reload_home();
}

export function end_session() {
  browser_storage()?.removeItem(KEY);
  reload_home();
}

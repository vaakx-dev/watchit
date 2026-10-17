import { useSyncExternalStore } from 'react';

const KEY = 'watchit:remaining-time';
const listeners = new Set<() => void>();

function read() {
  return localStorage.getItem(KEY) === 'true';
}

export function set_remaining_time(remaining: boolean) {
  localStorage.setItem(KEY, String(remaining));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function use_remaining_time() {
  return useSyncExternalStore(subscribe, read);
}

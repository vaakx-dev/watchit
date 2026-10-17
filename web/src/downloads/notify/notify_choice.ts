import { useSyncExternalStore } from 'react';

let wanted = false;
const listeners = new Set<() => void>();

export function notify_wanted() {
  return wanted;
}

export function set_notify_wanted(next: boolean) {
  wanted = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function use_notify_wanted() {
  return useSyncExternalStore(subscribe, notify_wanted);
}

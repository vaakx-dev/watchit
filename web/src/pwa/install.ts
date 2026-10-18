import { useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';

type InstallPrompt = Event & { prompt: () => Promise<void> };
export type InstallState = 'installed' | 'available' | 'manual' | 'insecure' | 'desktop';

const listeners = new Set<() => void>();
let prompt: InstallPrompt | null = null;

function notify() {
  listeners.forEach(listener => listener());
}

function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);
}

export function listen_for_install() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function state(): InstallState {
  if (isTauri()) return 'desktop';
  if (installed()) return 'installed';
  if (!window.isSecureContext) return 'insecure';
  return prompt ? 'available' : 'manual';
}

export function use_install() {
  const current = useSyncExternalStore(subscribe, state);
  const install = async () => {
    const pending = prompt;
    prompt = null;
    notify();
    await pending?.prompt();
  };
  return { state: current, install };
}

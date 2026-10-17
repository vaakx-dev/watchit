import { isTauri } from '@tauri-apps/api/core';

export function register_service_worker() {
  if (!import.meta.env.PROD || isTauri() || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}

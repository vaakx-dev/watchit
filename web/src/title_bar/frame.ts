import { isTauri } from '@tauri-apps/api/core';

export const framed = isTauri();

export function mark_frame() {
  if (framed) document.documentElement.classList.add('framed');
}

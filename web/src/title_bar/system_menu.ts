import type { MouseEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function open_system_menu(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  if ((event.target as HTMLElement).closest('a, button, input')) return;
  void invoke('show_system_menu').catch((cause: unknown) => console.error('system menu', cause));
}

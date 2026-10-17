import { invoke } from '@tauri-apps/api/core';

export function check_for_updates() {
  return invoke<string | null>('check_for_updates');
}

export function install_update() {
  return invoke<void>('install_update');
}

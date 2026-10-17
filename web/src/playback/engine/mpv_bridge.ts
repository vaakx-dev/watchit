import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type MpvValue = string | number | boolean;

type MpvMessage =
  | ['mpv-command', string[]]
  | ['mpv-set-prop', [string, MpvValue]]
  | ['mpv-observe-prop', string];

export type MpvEvent =
  | ['mpv-prop-change', { name: string; data: unknown }]
  | ['mpv-event-ended', { reason: string }];

export const desktop = isTauri();

export function mpv_send(msg: MpvMessage) {
  void invoke('mpv_message', { msg }).catch((cause: unknown) => console.error('mpv', cause));
}

export function mpv_listen(handler: (event: MpvEvent) => void) {
  const unlisten = listen<MpvEvent>('mpv', event => handler(event.payload));
  return () => { void unlisten.then(stop => stop()); };
}

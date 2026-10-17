import { useEffect, useRef } from 'react';

const SEEK_SECONDS = 10;
const SHORT_SEEK_SECONDS = 3;
const VOLUME_STEP = 5;

export type ShortcutActions = {
  toggle_play: () => void;
  seek_by: (seconds: number) => void;
  seek_to: (fraction: number) => void;
  volume_by: (step: number) => void;
  toggle_mute: () => void;
  toggle_fullscreen: () => void;
  open_menu: (menu: 'audio' | 'subtitles') => void;
  toggle_subtitles: () => void;
  next: (() => void) | null;
  escape: () => void;
  activity: () => void;
};

function typing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null);
}

function pressing(target: EventTarget | null, key: string) {
  return (key === ' ' || key === 'Enter') && target instanceof HTMLElement && target.closest('button, a, [role="menuitemradio"]') !== null;
}

function handle(event: KeyboardEvent, actions: ShortcutActions) {
  const key = event.key;
  if (key === 'Escape') return actions.escape();
  if (key === ' ' || key === 'k' || key === 'K') return actions.toggle_play();
  if (key === 'ArrowLeft' || key === 'ArrowRight') return actions.seek_by((key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? SHORT_SEEK_SECONDS : SEEK_SECONDS));
  if (key === 'ArrowUp' || key === 'ArrowDown') return actions.volume_by(key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP);
  if (key === 'm' || key === 'M') return actions.toggle_mute();
  if (key === 'f' || key === 'F') return actions.toggle_fullscreen();
  if (key === 'N' && event.shiftKey && actions.next) return actions.next();
  if (key === 's' || key === 'S') return actions.open_menu('subtitles');
  if (key === 'a' || key === 'A') return actions.open_menu('audio');
  if (key === 'c' || key === 'C') return actions.toggle_subtitles();
  if (/^[0-9]$/.test(key)) return actions.seek_to(Number(key) / 10);
  return 'unhandled';
}

export function use_shortcuts(actions: ShortcutActions) {
  const current = useRef(actions);
  current.current = actions;

  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target) || pressing(event.target, event.key)) return;
      current.current.activity();
      if (handle(event, current.current) === 'unhandled') return;
      event.preventDefault();
    }
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);
}

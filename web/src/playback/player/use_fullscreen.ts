import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { desktop } from '../engine/mpv_bridge';

export function use_fullscreen(root: RefObject<HTMLElement | null>) {
  const [active, set_active] = useState(false);

  useEffect(() => {
    if (desktop) {
      const window_handle = getCurrentWindow();
      const read = () => { void window_handle.isFullscreen().then(set_active); };
      const unlisten = window_handle.onResized(read);
      read();
      return () => {
        void unlisten.then(stop => stop());
        void window_handle.setFullscreen(false);
      };
    }
    const read = () => set_active(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', read);
    return () => document.removeEventListener('fullscreenchange', read);
  }, []);

  const toggle = useCallback(() => {
    if (desktop) {
      const window_handle = getCurrentWindow();
      void window_handle.isFullscreen().then(now => window_handle.setFullscreen(!now)).then(() => window_handle.isFullscreen()).then(set_active);
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen().catch(() => undefined);
  }, [root]);

  return { active, toggle };
}

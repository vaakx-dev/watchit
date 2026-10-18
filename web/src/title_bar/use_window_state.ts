import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function use_window_state() {
  const [maximized, set_maximized] = useState(false);
  const [focused, set_focused] = useState(true);

  useEffect(() => {
    const window_handle = getCurrentWindow();
    const read = () => { void window_handle.isMaximized().then(set_maximized); };
    const resized = window_handle.onResized(read);
    const focus = window_handle.onFocusChanged(event => set_focused(event.payload));
    read();
    return () => {
      void resized.then(stop => stop());
      void focus.then(stop => stop());
    };
  }, []);

  return { maximized, focused };
}

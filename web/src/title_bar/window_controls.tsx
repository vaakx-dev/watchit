import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useRef } from 'react';
import { use_snap_button } from './use_snap_button';
import { use_window_state } from './use_window_state';

export function WindowControls({ active = true }: { active?: boolean }) {
  const window_handle = getCurrentWindow();
  const { maximized, focused } = use_window_state();
  const maximize = useRef<HTMLButtonElement>(null);
  const pointer = use_snap_button(maximize, active);

  return <div className="window-controls" data-inactive={!focused || undefined}>
    <button type="button" className="minimize" aria-label="Minimize" title="Minimize" onClick={() => void window_handle.minimize()}>
      <Minus absoluteStrokeWidth strokeWidth={1} />
    </button>
    <button ref={maximize} type="button" className={maximized ? 'restore' : 'maximize'} aria-label={maximized ? 'Restore' : 'Maximize'}
      data-pointer={pointer} onClick={() => void window_handle.toggleMaximize()}>
      {maximized ? <Copy absoluteStrokeWidth strokeWidth={1} /> : <Square absoluteStrokeWidth strokeWidth={1} />}
    </button>
    <button type="button" className="close" aria-label="Close" title="Close" onClick={() => void window_handle.close()}>
      <X absoluteStrokeWidth strokeWidth={1} />
    </button>
  </div>;
}

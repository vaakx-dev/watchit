import { open_system_menu } from './system_menu';
import { WindowControls } from './window_controls';

export function WindowStrip() {
  return <div className="window-strip" data-tauri-drag-region="deep" onContextMenu={open_system_menu}><WindowControls /></div>;
}

import { WindowControls } from './window_controls';

export function WindowStrip() {
  return <div className="window-strip" data-tauri-drag-region="deep"><WindowControls /></div>;
}

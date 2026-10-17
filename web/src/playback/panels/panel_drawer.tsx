import type { ReactNode } from 'react';
import { Icon } from '../../ui/icon';
import { PANEL_TITLES, type Panel } from './panel';

export function PanelDrawer({ panel, on_close, children }: { panel: Panel; on_close: () => void; children: ReactNode }) {
  return <aside className="panel-drawer" aria-labelledby="panel-title" onPointerDown={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()}>
    <div className="panel-drawer-bar">
      <h2 id="panel-title">{PANEL_TITLES[panel]}</h2>
      <button type="button" className="icon-button small ghost" aria-label={`Close ${PANEL_TITLES[panel].toLowerCase()}`} onClick={on_close}><Icon name="close" /></button>
    </div>
    <div className="panel-drawer-body">{children}</div>
  </aside>;
}

import { useEffect, useRef } from 'react';
import { Icon } from '../../ui/icon';
import type { TrackMenu as Menu } from './use_tracks';

type Props = { title: string; menu: Menu; allow_off: boolean; on_close: () => void };

export function TrackMenu({ title, menu, allow_off, on_close }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }, []);

  const options = [...(allow_off ? [{ id: null, label: 'Off', detail: null }] : []), ...menu.options];
  return <div ref={panel} className="track-menu" role="menu" aria-label={title} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <h2>{title}</h2>
    <div className="track-menu-list">
      {options.map(option => <button type="button" role="menuitemradio" key={option.id ?? 'off'} aria-checked={option.id === menu.selected}
        onClick={() => { menu.select(option.id); on_close(); }}>
        <span className="track-menu-check">{option.id === menu.selected && <Icon name="check" size={16} />}</span>
        <span className="track-menu-label">{option.label}{option.detail && <small>{option.detail}</small>}</span>
      </button>)}
    </div>
  </div>;
}

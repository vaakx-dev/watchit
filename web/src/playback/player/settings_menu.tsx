import { useEffect, useRef } from 'react';
import { AudioLines, Captions, Check, ChevronLeft, ChevronRight, Layers, type LucideIcon } from 'lucide-react';
import type { TrackMenu } from './use_tracks';

export type SettingsMenuPage = 'main' | 'audio' | 'subtitles';

type Props = {
  page: SettingsMenuPage;
  audio: TrackMenu;
  subtitles: TrackMenu;
  source_label: string;
  on_page: (page: SettingsMenuPage | null) => void;
  on_sources: () => void;
};

const TITLES: Record<SettingsMenuPage, string> = { main: 'Settings', audio: 'Audio track', subtitles: 'Subtitles' };

function selected_label(menu: TrackMenu, fallback: string) {
  return menu.options.find(option => option.id === menu.selected)?.label ?? fallback;
}

function MainItem({ icon: Glyph, label, value, on_click }: { icon: LucideIcon; label: string; value: string; on_click: () => void }) {
  return <button type="button" role="menuitem" className="settings-item" aria-haspopup="true" onClick={on_click}>
    <span className="settings-icon"><Glyph /></span>
    <span className="settings-label">{label}</span>
    <span className="settings-value">{value}<ChevronRight /></span>
  </button>;
}

function MainPage({ audio, subtitles, source_label, on_page, on_sources }: Omit<Props, 'page'>) {
  return <div className="settings-list">
    {subtitles.options.length > 0 && <MainItem icon={Captions} label="Subtitles" value={selected_label(subtitles, 'Off')} on_click={() => on_page('subtitles')} />}
    {audio.options.length > 1 && <MainItem icon={AudioLines} label="Audio track" value={selected_label(audio, '')} on_click={() => on_page('audio')} />}
    <MainItem icon={Layers} label="Source" value={source_label} on_click={on_sources} />
  </div>;
}

function TrackPage({ title, menu, allow_off, on_back, on_close }: { title: string; menu: TrackMenu; allow_off: boolean; on_back: () => void; on_close: () => void }) {
  const options = [...(allow_off ? [{ id: null, label: 'Off', detail: null }] : []), ...menu.options];
  return <>
    <div className="settings-header">
      <button type="button" className="settings-back" aria-label="Back to settings" onClick={on_back}><ChevronLeft /></button>
      <h2>{title}</h2>
    </div>
    <div className="settings-list">
      {options.map(option => <button type="button" role="menuitemradio" className="settings-option" key={option.id ?? 'off'} aria-checked={option.id === menu.selected}
        onClick={() => { menu.select(option.id); on_close(); }}>
        {option.id === menu.selected && <Check />}
        <span className="settings-label">{option.label}{option.detail && <small>{option.detail}</small>}</span>
      </button>)}
    </div>
  </>;
}

export function SettingsMenu(props: Props) {
  const { page, audio, subtitles, on_page } = props;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = panel.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel.current?.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  }, [page]);

  const back = () => on_page('main');
  const close = () => on_page(null);
  return <div ref={panel} className="settings-menu" role="menu" aria-label={TITLES[page]} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    {page === 'main' && <MainPage {...props} />}
    {page === 'subtitles' && <TrackPage title={TITLES.subtitles} menu={subtitles} allow_off on_back={back} on_close={close} />}
    {page === 'audio' && <TrackPage title={TITLES.audio} menu={audio} allow_off={false} on_back={back} on_close={close} />}
  </div>;
}

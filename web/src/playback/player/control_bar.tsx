import { Icon, type IconName } from '../../ui/icon';
import type { EngineState } from '../engine/types';
import type { Panel } from '../panels/panel';
import { Timeline } from './timeline';
import { TrackMenu } from './track_menu';
import type { TrackMenu as Menu } from './use_tracks';
import { Volume } from './volume';

export type MenuName = 'audio' | 'subtitles';

type Props = {
  state: EngineState;
  duration: number | null;
  audio: Menu;
  subtitles: Menu;
  menu: MenuName | null;
  panel: Panel | null;
  has_episodes: boolean;
  next_label: string | null;
  on_menu: (menu: MenuName | null) => void;
  on_panel: (panel: Panel | null) => void;
  on_toggle_play: () => void;
  on_next: () => void;
  on_seek: (seconds: number) => void;
  on_drag: (dragging: boolean) => void;
  on_volume: (volume: number) => void;
  on_mute: (muted: boolean) => void;
};

function BarButton({ icon, label, shortcut, pressed, on_click }: { icon: IconName; label: string; shortcut?: string; pressed?: boolean; on_click: () => void }) {
  return <button type="button" className="player-button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label}
    aria-pressed={pressed} onClick={on_click}><Icon name={icon} /></button>;
}

export function ControlBar(props: Props) {
  const { state, menu, panel, audio, subtitles } = props;
  const toggle_menu = (name: MenuName) => props.on_menu(menu === name ? null : name);
  const toggle_panel = (name: Panel) => props.on_panel(panel === name ? null : name);

  return <div className="control-bar">
    <Timeline time={state.time} duration={props.duration} buffered={state.buffered} on_seek={props.on_seek} on_drag={props.on_drag} />
    <div className="control-row">
      <BarButton icon={state.paused ? 'play' : 'pause'} label={state.paused ? 'Play' : 'Pause'} shortcut="Space" on_click={props.on_toggle_play} />
      {props.next_label && <BarButton icon="next" label={props.next_label} shortcut="Shift+N" on_click={props.on_next} />}
      <Volume volume={state.volume} muted={state.muted} on_volume={props.on_volume} on_mute={props.on_mute} />
      <span className="control-spacer" />
      {subtitles.options.length > 0 && <BarButton icon="subtitles" label="Subtitles" shortcut="S" pressed={menu === 'subtitles'} on_click={() => toggle_menu('subtitles')} />}
      {audio.options.length > 1 && <BarButton icon="audio" label="Audio" shortcut="A" pressed={menu === 'audio'} on_click={() => toggle_menu('audio')} />}
      <BarButton icon="sources" label="Sources" pressed={panel === 'sources'} on_click={() => toggle_panel('sources')} />
      {props.has_episodes && <BarButton icon="episodes" label="Episodes" pressed={panel === 'episodes'} on_click={() => toggle_panel('episodes')} />}
    </div>
    {menu === 'subtitles' && <TrackMenu title="Subtitles" menu={subtitles} allow_off on_close={() => props.on_menu(null)} />}
    {menu === 'audio' && <TrackMenu title="Audio" menu={audio} allow_off={false} on_close={() => props.on_menu(null)} />}
  </div>;
}

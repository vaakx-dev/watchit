import { Captions, ListVideo, Maximize, Minimize, Pause, Play, Settings, SkipForward } from 'lucide-react';
import type { EngineState } from '../engine/types';
import type { Panel } from '../panels/panel';
import { PlayerButton } from './player_button';
import { SeekBar } from './seek_bar';
import { SettingsMenu, type SettingsPage } from './settings_menu';
import { TimeDisplay } from './time_display';
import type { TrackMenu } from './use_tracks';
import { Volume } from './volume';

type Props = {
  state: EngineState;
  duration: number | null;
  audio: TrackMenu;
  subtitles: TrackMenu;
  source_label: string;
  menu: SettingsPage | null;
  panel: Panel | null;
  has_episodes: boolean;
  next_label: string | null;
  fullscreen: { active: boolean; toggle: () => void };
  on_menu: (menu: SettingsPage | null) => void;
  on_panel: (panel: Panel | null) => void;
  on_toggle_play: () => void;
  on_toggle_subtitles: () => void;
  on_next: () => void;
  on_seek: (seconds: number) => void;
  on_drag: (dragging: boolean) => void;
  on_volume: (volume: number) => void;
  on_mute: (muted: boolean) => void;
};

export function ControlBar(props: Props) {
  const { state, menu, panel, subtitles, fullscreen } = props;
  const open_sources = () => { props.on_menu(null); props.on_panel(panel === 'sources' ? null : 'sources'); };

  return <div className="control-bar" data-menu={menu ?? undefined}>
    <SeekBar time={state.time} duration={props.duration} buffered={state.buffered} on_seek={props.on_seek} on_drag={props.on_drag} />
    <div className="control-row">
      <div className="control-group">
        <div className="player-pill play-pill">
          <PlayerButton label={state.paused ? 'Play' : 'Pause'} shortcut="k" on_click={props.on_toggle_play}>
            {state.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
          </PlayerButton>
          {props.next_label && <PlayerButton label={props.next_label} shortcut="SHIFT+n" on_click={props.on_next}><SkipForward fill="currentColor" /></PlayerButton>}
        </div>
        <Volume volume={state.volume} muted={state.muted} on_volume={props.on_volume} on_mute={props.on_mute} />
        <TimeDisplay time={state.time} duration={props.duration} />
      </div>
      <div className="player-pill control-group">
        {props.has_episodes && <PlayerButton label="Episodes" pressed={panel === 'episodes'} on_click={() => props.on_panel(panel === 'episodes' ? null : 'episodes')}><ListVideo /></PlayerButton>}
        {subtitles.options.length > 0 && <PlayerButton label="Subtitles" shortcut="c" pressed={subtitles.selected !== null} on_click={props.on_toggle_subtitles}><Captions /></PlayerButton>}
        <PlayerButton label="Settings" expanded={menu !== null} on_click={() => props.on_menu(menu ? null : 'main')}><Settings /></PlayerButton>
        <PlayerButton label={fullscreen.active ? 'Exit full screen' : 'Full screen'} shortcut="f" on_click={fullscreen.toggle}>
          {fullscreen.active ? <Minimize /> : <Maximize />}
        </PlayerButton>
      </div>
    </div>
    {menu && <SettingsMenu page={menu} audio={props.audio} subtitles={subtitles} source_label={props.source_label} on_page={props.on_menu} on_sources={open_sources} />}
  </div>;
}

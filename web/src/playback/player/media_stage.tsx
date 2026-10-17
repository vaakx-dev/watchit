import { useEffect, useRef, useState, type RefObject } from 'react';
import { episode_code } from '../../catalog/episodes';
import type { EpisodeEntry, Title } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { Icon } from '../../ui/icon';
import { desktop } from '../engine/mpv_bridge';
import { use_engine } from '../engine/use_engine';
import type { Panel } from '../panels/panel';
import { use_progress_report } from '../progress/use_progress_report';
import { use_session } from '../session/use_session';
import type { PlaySource } from '../sources/types';
import { use_file_source } from '../sources/use_file_source';
import { ControlBar, type MenuName } from './control_bar';
import { ENDING_SECONDS, EndingCard } from './ending_card';
import { stage_message } from './stage_message';
import { StageStatus } from './stage_status';
import { back_href, TopBar } from './top_bar';
import { use_idle } from './use_idle';
import { use_shortcuts } from './use_shortcuts';
import { use_stage_load } from './use_stage_load';
import { use_surface_clicks } from './use_surface_clicks';
import { use_tracks } from './use_tracks';

type Props = {
  title: Title;
  source: PlaySource;
  start: number;
  position: RefObject<number>;
  next: EpisodeEntry | null;
  library: Library;
  panel: Panel | null;
  has_episodes: boolean;
  fullscreen: { active: boolean; toggle: () => void };
  on_panel: (panel: Panel | null) => void;
};

function use_transparent_window(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add('mpv-layer');
    return () => document.documentElement.classList.remove('mpv-layer');
  }, [active]);
}

export function MediaStage({ title, source, start, position, next, library, panel, has_episodes, fullscreen, on_panel }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const { engine, state } = use_engine(video);
  const { file, transfer, error: source_error } = use_file_source(title.id, source);
  const playback = use_session(title.id, file, start);
  const { session } = playback;
  const { audio, subtitles, text_subtitle } = use_tracks(engine, state, playback);
  const [menu, set_menu] = useState<MenuName | null>(null);
  const [dragging, set_dragging] = useState(false);
  const [dismissed, set_dismissed] = useState(false);
  const duration = session?.duration_seconds ?? state.duration;
  const ending = !dismissed && duration !== null && (state.ended || (state.time > 0 && duration - state.time <= ENDING_SECONDS));
  const idle = use_idle(state.paused || menu !== null || panel !== null || dragging || ending);
  const error = source_error ?? playback.error ?? state.error;
  const go_next = () => { if (next) window.location.hash = `#/watch/${next.id}`; };

  use_transparent_window(engine?.kind === 'mpv');
  use_stage_load(engine, session, playback.start, text_subtitle);
  use_progress_report(title.id, { time: state.time, duration, paused: state.paused, ready: session !== null && !state.waiting });
  useEffect(() => { if (session) position.current = state.time; }, [position, session, state.time]);

  const toggle_play = () => { if (state.paused) engine?.play(); else engine?.pause(); };
  const seek = (seconds: number) => engine?.seek(Math.min(Math.max(seconds, 0), duration ?? seconds));
  const clicks = use_surface_clicks(toggle_play, fullscreen.toggle);

  use_shortcuts({
    toggle_play,
    seek_by: seconds => seek(state.time + seconds),
    seek_to: fraction => { if (duration) seek(duration * fraction); },
    volume_by: step => engine?.set_volume(Math.min(Math.max((state.muted ? 0 : state.volume) + step, 0), 100)),
    toggle_mute: () => engine?.set_muted(!state.muted),
    toggle_fullscreen: fullscreen.toggle,
    open_menu: name => set_menu(current => current === name ? null : name),
    toggle_subtitles: () => subtitles.select(subtitles.selected === null ? subtitles.options[0]?.id ?? null : null),
    next: next ? go_next : null,
    escape: () => {
      if (menu) set_menu(null);
      else if (panel) on_panel(null);
      else if (fullscreen.active) fullscreen.toggle();
      else window.location.hash = back_href(title);
    },
    activity: idle.wake,
  });

  return <div className="stage" data-idle={!idle.shown || undefined} data-desktop={desktop || undefined}
    onPointerMove={idle.wake} onPointerLeave={idle.sleep} onWheel={event => engine?.set_volume(Math.min(Math.max(state.volume + (event.deltaY < 0 ? 5 : -5), 0), 100))}>
    {!desktop && <video ref={video} className="stage-video" playsInline aria-label={`${title.title} video`} />}
    <div className="stage-surface" {...clicks} onPointerDown={() => set_menu(null)} />
    <StageStatus message={error ? null : stage_message({ has_file: file !== null, session, state })} error={error} transfer={transfer}
      on_sources={() => on_panel('sources')} />
    <div className="player-overlay" data-shown={idle.shown || undefined}>
      <div className="player-bar" onPointerEnter={() => idle.hover(true)} onPointerLeave={() => idle.hover(false)}>
        <TopBar title={title}>
          <button type="button" className="player-button" aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'} title={`${fullscreen.active ? 'Exit full screen' : 'Full screen'} (F)`}
            onClick={fullscreen.toggle}><Icon name={fullscreen.active ? 'fullscreen-exit' : 'fullscreen'} /></button>
        </TopBar>
      </div>
      <div className="player-bar player-bottom" onPointerEnter={() => idle.hover(true)} onPointerLeave={() => idle.hover(false)}>
        <ControlBar state={state} duration={duration} audio={audio} subtitles={subtitles} menu={menu} panel={panel} has_episodes={has_episodes}
          next_label={next ? `Next episode, ${episode_code(next)}` : null} on_menu={set_menu} on_panel={on_panel} on_toggle_play={toggle_play}
          on_next={go_next} on_seek={seek} on_drag={set_dragging} on_volume={volume => engine?.set_volume(volume)} on_mute={muted => engine?.set_muted(muted)} />
      </div>
    </div>
    {ending && <EndingCard title={title} next={next} library={library} on_dismiss={() => set_dismissed(true)} />}
  </div>;
}

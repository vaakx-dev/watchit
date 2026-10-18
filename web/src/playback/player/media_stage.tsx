import { useEffect, useRef, useState, type RefObject } from 'react';
import { episode_code } from '../../catalog/episodes';
import type { EpisodeEntry, Title } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { framed } from '../../title_bar/frame';
import { WindowControls } from '../../title_bar/window_controls';
import { desktop } from '../engine/mpv_bridge';
import { use_engine } from '../engine/use_engine';
import type { Panel } from '../panels/panel';
import { use_progress_report } from '../progress/use_progress_report';
import { use_session } from '../session/use_session';
import { source_label, type PlaySource } from '../sources/types';
import { use_file_source } from '../sources/use_file_source';
import { use_stall_fallback } from '../sources/use_stall_fallback';
import { Bezel } from './bezel';
import { ControlBar } from './control_bar';
import { ENDING_SECONDS, EndingCard } from './ending_card';
import type { SettingsMenuPage } from './settings_menu';
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
  switched_from: PlaySource | null;
  on_stall: (() => void) | null;
  on_panel: (panel: Panel | null) => void;
};

function use_transparent_window(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add('mpv-layer');
    return () => document.documentElement.classList.remove('mpv-layer');
  }, [active]);
}

export function MediaStage({ title, source, start, position, next, library, panel, has_episodes, fullscreen, switched_from, on_stall, on_panel }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const { engine, state } = use_engine(video);
  const { file, transfer, error: source_error } = use_file_source(title.id, source);
  const playback = use_session(title.id, file, start);
  const { session } = playback;
  const { audio, subtitles, text_subtitle } = use_tracks(engine, state, playback);
  const [menu, set_menu] = useState<SettingsMenuPage | null>(null);
  const [bezel, set_bezel] = useState<{ paused: boolean; count: number } | null>(null);
  const [dragging, set_dragging] = useState(false);
  const [dismissed, set_dismissed] = useState(false);
  const duration = session?.duration_seconds ?? state.duration;
  const ending = !dismissed && duration !== null && (state.ended || (state.time > 0 && duration - state.time <= ENDING_SECONDS));
  const idle = use_idle(state.paused || menu !== null || panel !== null || dragging || ending);
  const error = source_error ?? playback.error ?? state.error;
  const captioned = framed && !fullscreen.active;
  const go_next = () => { if (next) window.location.hash = `#/watch/${next.id}`; };

  use_transparent_window(engine?.kind === 'mpv');
  use_stall_fallback(on_stall !== null && session === null, transfer, () => on_stall?.());
  use_stage_load(engine, session, playback.start, text_subtitle);
  use_progress_report(title.id, { time: state.time, duration, paused: state.paused, ready: session !== null && !state.waiting }, saved => {
    if (saved.entry.status !== (library.entries[title.id]?.status ?? null)) library.refresh();
  });
  useEffect(() => { if (session) position.current = state.time; }, [position, session, state.time]);

  const toggle_play = () => { if (state.paused) engine?.play(); else engine?.pause(); };
  const seek = (seconds: number) => engine?.seek(Math.min(Math.max(seconds, 0), duration ?? seconds));
  const toggle_play_with_bezel = () => {
    set_bezel(current => ({ paused: !state.paused, count: (current?.count ?? 0) + 1 }));
    toggle_play();
  };
  const toggle_subtitles = () => subtitles.select(subtitles.selected === null ? subtitles.options[0]?.id ?? null : null);
  const clicks = use_surface_clicks(toggle_play_with_bezel, fullscreen.toggle);

  use_shortcuts({
    toggle_play: toggle_play_with_bezel,
    seek_by: seconds => seek(state.time + seconds),
    seek_to: fraction => { if (duration) seek(duration * fraction); },
    volume_by: step => engine?.set_volume(Math.min(Math.max((state.muted ? 0 : state.volume) + step, 0), 100)),
    toggle_mute: () => engine?.set_muted(!state.muted),
    toggle_fullscreen: fullscreen.toggle,
    open_menu: name => set_menu(current => current === name ? null : name),
    toggle_subtitles,
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
      switched={switched_from && `Switched to ${source_label(source)} · the ${source_label(switched_from)} source found no peers`}
      starting={source.kind === 'torrent' && (session === null || state.time <= playback.start)} on_sources={() => on_panel('sources')} />
    {bezel && <Bezel key={bezel.count} paused={bezel.paused} />}
    <div className="player-overlay" data-shown={idle.shown || undefined}>
      <div className="player-gradient top" />
      <div className="player-gradient bottom" />
      <div className="player-top-bar" data-tauri-drag-region={captioned ? 'deep' : undefined} onPointerEnter={() => idle.hover(true)} onPointerLeave={() => idle.hover(false)}>
        <TopBar title={title} />
      </div>
      {captioned && <WindowControls active={idle.shown} />}
      <div className="player-bottom" onPointerEnter={() => idle.hover(true)} onPointerLeave={() => idle.hover(false)}>
        <ControlBar state={state} duration={duration} audio={audio} subtitles={subtitles} source_label={source_label(source)} menu={menu} panel={panel}
          has_episodes={has_episodes} next_label={next ? `Next episode, ${episode_code(next)}` : null} fullscreen={fullscreen} on_menu={set_menu} on_panel={on_panel}
          on_toggle_play={toggle_play} on_toggle_subtitles={toggle_subtitles} on_next={go_next} on_seek={seek} on_drag={set_dragging}
          on_volume={volume => engine?.set_volume(volume)} on_mute={muted => engine?.set_muted(muted)} />
      </div>
    </div>
    {ending && <EndingCard title={title} next={next} library={library} on_dismiss={() => set_dismissed(true)} />}
  </div>;
}

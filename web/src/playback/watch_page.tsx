import { useEffect, useRef, useState } from 'react';
import type { TitleResult } from '../catalog/types';
import { use_season_navigation } from '../catalog/use_season_navigation';
import type { Library } from '../library/use_library';
import { EpisodesPanel } from './panels/episodes_panel';
import type { Panel } from './panels/panel';
import { PanelDrawer } from './panels/panel_drawer';
import { SourcesPanel } from './panels/sources_panel';
import { EmbedStage } from './player/embed_stage';
import { MediaStage } from './player/media_stage';
import { TopBar } from './player/top_bar';
import { use_fullscreen } from './player/use_fullscreen';
import { resume_at } from './progress/resume';
import { source_key } from './sources/types';
import { use_sources } from './sources/use_sources';

export function WatchPage({ result, library }: { result: TitleResult; library: Library }) {
  const { title } = result;
  const root = useRef<HTMLDivElement>(null);
  const position = useRef(resume_at(result.position));
  const sources = use_sources(title, result.playback_source);
  const seasons = use_season_navigation(title.series ? title.id : null);
  const fullscreen = use_fullscreen(root);
  const [panel, set_panel] = useState<Panel | null>(null);
  const has_episodes = title.series !== null;
  const { selected } = sources;
  const playable = sources.selected !== undefined || sources.searching;

  useEffect(() => {
    if (playable) void library.remember(title.id);
  }, [library.remember, title.id, playable]);

  function stage() {
    if (selected?.kind === 'embed') return <EmbedStage title={title} provider={selected.provider} library={library} panel={panel} has_episodes={has_episodes} on_panel={set_panel} />;
    if (selected) return <MediaStage key={source_key(selected)} title={title} source={selected} start={position.current} position={position}
      next={seasons.navigation?.next ?? null} library={library} panel={panel} has_episodes={has_episodes} fullscreen={fullscreen} on_panel={set_panel} />;
    return <div className="stage embed-stage">
      <div className="embed-bar"><TopBar title={title} /></div>
      <p className="player-unavailable" role="status">{sources.searching ? 'Looking for sources…' : 'No playback sources are available for this title.'}</p>
    </div>;
  }

  return <div ref={root} className="watch-player" aria-labelledby="watch-title" data-panel={panel ?? undefined}>
    {stage()}
    {panel && <PanelDrawer panel={panel} on_close={() => set_panel(null)}>
      {panel === 'sources' ? <SourcesPanel sources={sources} title_id={title.id} /> : <EpisodesPanel episode={title} seasons={seasons} library={library} />}
    </PanelDrawer>}
  </div>;
}

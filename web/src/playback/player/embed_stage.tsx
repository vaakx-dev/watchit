import type { Title } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { Layers, ListVideo } from 'lucide-react';
import { FinishedPrompt } from '../finished';
import type { Panel } from '../panels/panel';
import { FRAME_PERMISSIONS, type Provider } from '../providers';
import { EmbedBar } from './top_bar';

type Props = { title: Title; provider: Provider; library: Library; panel: Panel | null; has_episodes: boolean; on_panel: (panel: Panel | null) => void };

export function EmbedStage({ title, provider, library, panel, has_episodes, on_panel }: Props) {
  const url = provider.url(title);
  const toggle = (name: Panel) => on_panel(panel === name ? null : name);
  return <div className="stage embed-stage">
    <EmbedBar title={title}>
      <button type="button" className="icon-button ghost" aria-label="Sources" title="Sources" aria-pressed={panel === 'sources'} onClick={() => toggle('sources')}><Layers /></button>
      {has_episodes && <button type="button" className="icon-button ghost" aria-label="Episodes" title="Episodes" aria-pressed={panel === 'episodes'} onClick={() => toggle('episodes')}><ListVideo /></button>}
    </EmbedBar>
    <div className="embed-frame">
      {url ? <iframe key={url} title={`${title.title} player`} src={url} allow={FRAME_PERMISSIONS} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : <p className="player-unavailable">Playback is unavailable for this title.</p>}
    </div>
    <div className="embed-footer"><FinishedPrompt title={title} library={library} /></div>
  </div>;
}

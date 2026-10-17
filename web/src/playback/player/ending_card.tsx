import { Artwork } from '../../catalog/components/artwork';
import { episode_code } from '../../catalog/episodes';
import type { EpisodeEntry, Title } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { Icon } from '../../ui/icon';
import { FinishedPrompt } from '../finished';

export const ENDING_SECONDS = 35;

export function EndingCard({ title, next, library, on_dismiss }: { title: Title; next: EpisodeEntry | null; library: Library; on_dismiss: () => void }) {
  return <section className="ending-card" aria-label={next ? 'Up next' : 'Finished'} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    {next && <div className="ending-next">
      <div className="ending-still"><Artwork src={next.artwork} /></div>
      <div className="ending-copy">
        <span className="ending-label">Next on {title.series?.title}</span>
        <span className="ending-title">{episode_code(next)} · {next.title}</span>
      </div>
    </div>}
    <FinishedPrompt title={title} library={library} />
    <div className="ending-actions">
      <button type="button" className="button ghost small" onClick={on_dismiss}>Dismiss</button>
      {next && <a className="button primary small" href={`#/watch/${next.id}`}><Icon name="play" />Watch now</a>}
    </div>
  </section>;
}

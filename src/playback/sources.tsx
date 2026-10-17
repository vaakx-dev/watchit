import { Choices } from '../ui/choices';
import type { Source } from './providers';

export function SourceChoices({ sources, provider, error, on_choose }: {
  sources: readonly Source[];
  provider: Source | undefined;
  error: string | null;
  on_choose: (source: string) => void;
}) {
  if (!provider) return <p className="watch-note">No playback sources are available for this title.</p>;
  return <div className="watch-sources">
    <span aria-hidden="true">Source</span>
    <Choices label="Playback source" options={sources.map(source => ({ value: source.id, label: source.name }))} value={provider.id} on_change={on_choose} />
    <p className="watch-note" role={error ? 'alert' : undefined}>
      {error ? `Your source choice wasn't saved: ${error}` : 'Not loading? Try another source. Your choice is remembered for this title.'}
    </p>
  </div>;
}

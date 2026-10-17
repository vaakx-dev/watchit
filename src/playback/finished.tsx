import type { Title } from '../catalog/types';
import { StatusEye } from '../library/components/eye';
import { TitleRating } from '../library/components/title_rating';
import type { Library } from '../library/use_library';

export function FinishedPrompt({ title, library }: { title: Title; library: Library }) {
  const watched = library.entries[title.id]?.status === 'watched';
  const question = `Finished this ${title.kind === 'episode' ? 'episode' : 'movie'}?`;

  return <div className="finished" role="group" aria-label={question}>
    <span className="finished-question">{question}</span>
    <button type="button" className="button secondary small" disabled={!library.ready} aria-pressed={watched}
      onClick={() => { void library.update(title.id, { status: watched ? null : 'watched' }); }}>
      <StatusEye status={watched ? 'watched' : null} />{watched ? 'Watched' : 'Mark watched'}
    </button>
    <div className="finished-rating"><span>Rate</span><TitleRating title={title} library={library} /></div>
  </div>;
}

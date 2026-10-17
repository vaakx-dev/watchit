import { Icon } from '../../ui/icon';
import { Artwork } from '../components/artwork';
import { StatusEye } from '../../library/components/eye';
import { TitleRating } from '../../library/components/title_rating';
import type { Library } from '../../library/use_library';
import type { EpisodeEntry } from '../types';

function status_note(watched: boolean, up_next: boolean) {
  if (up_next) return <span className="up-next">Up next</span>;
  return watched ? 'Watched' : null;
}

export function EpisodeRow({ episode, up_next, library }: { episode: EpisodeEntry; up_next: boolean; library: Library }) {
  const watched = library.entries[episode.id]?.status === 'watched';
  const name = `episode ${episode.episode ?? ''}: ${episode.title}`;
  const note = status_note(watched, up_next);

  return <li className="episode-row" data-up-next={up_next || undefined} data-watched={watched || undefined}>
    <a className="episode-still" href={`#/title/${episode.id}`} tabIndex={-1} aria-hidden="true"><Artwork src={episode.artwork} /></a>
    <div className="episode-copy">
      <h3><a href={`#/title/${episode.id}`}><span className="episode-number">{episode.episode}</span>{episode.title}</a></h3>
      {note && <p className="episode-note">{note}</p>}
    </div>
    <div className="episode-rating"><TitleRating title={episode} library={library} /></div>
    <button type="button" className="icon-button small ghost episode-watched" disabled={!library.ready} aria-pressed={watched}
      aria-label={`Watched ${name}`} title={watched ? 'Watched' : 'Mark watched'}
      onClick={() => { void library.update(episode.id, { status: watched ? null : 'watched' }); }}>
      <StatusEye status={watched ? 'watched' : null} />
    </button>
    <a className="icon-button small episode-play" href={`#/watch/${episode.id}`} aria-label={`Play ${name}`}><Icon name="play" /></a>
  </li>;
}

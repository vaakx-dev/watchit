import { Play } from 'lucide-react';
import { Artwork } from '../../components/artwork';
import { ProgressBar } from '../../components/progress_bar';
import { runtime, time_left } from '../../format';
import type { EpisodeEntry, SavedPosition } from '../../types';
import { DownloadEpisodeButton } from '../../../downloads/actions/download_episode_button';
import { StatusEye } from '../../../library/components/eye';
import type { Library } from '../../../library/use_library';

type Props = { episode: EpisodeEntry; minutes: number | null; up_next: boolean; resume: SavedPosition | null; library: Library };

function detail(minutes: number | null, watched: boolean, resume: SavedPosition | null) {
  const state = watched ? 'Watched' : resume ? time_left(resume) : null;
  return [runtime(minutes), state].filter(Boolean).join(' · ');
}

export function EpisodeRow({ episode, minutes, up_next, resume, library }: Props) {
  const watched = library.entries[episode.id]?.status === 'watched';
  const name = `${episode.episode ?? ''}. ${episode.title}`;

  return <li className="episode-row" data-up-next={up_next || undefined} data-watched={watched || undefined}>
    <a className="episode-link" href={`#/watch/${episode.id}`} aria-label={`Play episode ${name}`}>
      <span className="episode-still">
        <Artwork src={episode.artwork} />
        {up_next && <span className="up-next-badge">Up next</span>}
        <span className="episode-play" aria-hidden="true"><Play fill="currentColor" /></span>
        {(watched || resume) && <ProgressBar resume={resume} watched={watched} />}
      </span>
      <span className="episode-copy">
        <span className="episode-name">{name}</span>
        <span className="episode-detail">{detail(minutes, watched, resume)}</span>
        {episode.synopsis && <span className="episode-synopsis">{episode.synopsis}</span>}
      </span>
    </a>
    <span className="episode-action">
      {watched
        ? <button type="button" className="icon-button small ghost" disabled={!library.ready} aria-pressed="true" aria-label={`Watched episode ${name}. Mark unwatched`}
          title="Watched" onClick={() => { void library.update(episode.id, { status: null }); }}><StatusEye status="watched" /></button>
        : <DownloadEpisodeButton episode={episode} />}
    </span>
  </li>;
}

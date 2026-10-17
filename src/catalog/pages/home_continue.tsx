import { Icon } from '../../ui/icon';
import { Artwork } from '../components/artwork';
import { Shelf } from '../components/shelf';
import { CatalogStatus } from '../components/status';
import { use_continue } from '../use_continue';
import { play_target, progress_line } from './home_progress';
import { mine_route } from '../../navigation/route';
import { StatusControls } from '../../library/components/status';
import type { LibraryItem } from '../../library/types';
import type { Library } from '../../library/use_library';

function ContinueCard({ item, library }: { item: LibraryItem; library: Library }) {
  const { title, progress } = item;
  const line = progress_line(item);
  const play = play_target(item);

  return <article className="continue-card">
    <a className="continue-image" href={play ?? `#/title/${title.id}`} aria-label={`${play ? 'Play ' : ''}${title.title}, ${line}`}>
      <Artwork src={progress?.next?.artwork || title.artwork} label={title.title} />
      {play && <span className="icon-button small on-image continue-play" aria-hidden="true"><Icon name="play" /></span>}
    </a>
    <div className="card-status continue-status"><StatusControls title={title} library={library} /></div>
    <h3><a href={`#/title/${title.id}`}>{title.title}</a></h3>
    <p className="card-meta">{line}</p>
  </article>;
}

export function ContinueRow({ library }: { library: Library }) {
  const { resource, retry } = use_continue(library);
  if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
  if (resource.status !== 'ready' || !resource.data.items.length) return null;

  return <Shelf title="Continue watching" link={{ href: mine_route('watching'), label: 'My shows' }}>
    {resource.data.items.map(item => <ContinueCard item={item} key={item.title.id} library={library} />)}
  </Shelf>;
}

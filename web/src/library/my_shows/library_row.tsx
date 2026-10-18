import { Play } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import { use_long_press } from '../../ui/use_long_press';
import { StatusEye } from '../components/eye';
import { StatusMore } from '../components/status_more';
import { TitleRating } from '../components/title_rating';
import { use_status_menu } from '../components/use_status_menu';
import { STATUSES, type LibraryItem, type Shelf } from '../types';
import type { Library } from '../use_library';
import { added_line, length_line, play_action, progress_lines, type Action } from './row_lines';
import { shows_progress } from './shelves';

function PlayButton({ action }: { action: Action }) {
  return <a className="button primary small myshows-play" href={action.href} aria-label={action.name}><Play fill="currentColor" />{action.label}</a>;
}

function Progress({ fraction }: { fraction: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return <span className="myshows-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <span style={{ width: `${percent}%` }} />
  </span>;
}

export function LibraryRow({ item, shelf, library }: { item: LibraryItem; shelf: Shelf; library: Library }) {
  const { title } = item;
  const menu = use_status_menu(title, library);
  const press = use_long_press(menu.show);
  const href = `#/title/${title.id}`;
  const progress = shows_progress(shelf) ? progress_lines(item) : null;
  const status_shelf = STATUSES.some(status => status === shelf);
  const action = shelf === 'watched' || shelf === 'dropped' ? null : play_action(item);
  const note = progress ? progress.note : added_line(item);

  return <li className="myshows-row" data-status={menu.status ?? undefined} data-more={progress ? 'hover' : undefined} {...press}>
    <a className="myshows-poster" href={href} tabIndex={-1} aria-hidden="true"><Artwork src={title.artwork} label={title.title} /></a>
    <div className="myshows-copy">
      <h3><a href={href}>{title.title}</a></h3>
      <p className="myshows-line">
        {!status_shelf && menu.status && <StatusEye status={menu.status} />}
        {progress ? progress.line : length_line(item)}
      </p>
      {progress && <Progress fraction={progress.fraction} />}
      {note && <p className="myshows-note">{note}</p>}
    </div>
    <div className="myshows-actions">
      {shelf === 'watched' && <TitleRating title={title} library={library} />}
      {action && <PlayButton action={action} />}
      <StatusMore menu={menu} title={title.title} />
    </div>
    {menu.panel}
  </li>;
}

import { Bookmark } from 'lucide-react';
import { TrailerAction } from '../components/trailer';
import type { Title } from '../types';
import { RateAction } from '../../library/components/rate_action';
import { StatusControls } from '../../library/components/status';
import type { Library } from '../../library/use_library';

export function TitleIcons({ title, library }: { title: Title; library: Library }) {
  const saved = library.entries[title.id]?.saved ?? false;

  return <div className="title-icons">
    {title.kind !== 'episode' && <StatusControls title={title} library={library} labelled />}
    <RateAction title={title} library={library} />
    <button type="button" className="title-action" disabled={!library.ready} aria-pressed={saved}
      onClick={() => { void library.toggle_saved(title); }}><Bookmark fill={saved ? 'currentColor' : 'none'} /><span>My list</span></button>
    <TrailerAction title={title.title} trailers={title.trailers} />
  </div>;
}

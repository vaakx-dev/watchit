import type { Transfer } from '../../torrents/types';
import { library_groups } from './library_groups';
import { TitleGroup } from './title_group';

export function CompletedSection({ transfers, on_remove }: { transfers: Transfer[]; on_remove: (transfer: Transfer) => void }) {
  if (!transfers.length) return null;
  return <section className="downloads-section" aria-labelledby="completed-heading">
    <h2 id="completed-heading">Downloaded</h2>
    <ol className="library-list">
      {library_groups(transfers).map(group => <TitleGroup key={group.id} group={group} on_remove={on_remove} />)}
    </ol>
  </section>;
}

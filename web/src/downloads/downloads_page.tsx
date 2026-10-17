import { Download } from 'lucide-react';
import { useState } from 'react';
import { use_transfers } from '../torrents/transfer_store';
import type { Transfer } from '../torrents/types';
import { EmptyState } from '../ui/empty_state';
import { Page } from '../ui/page';
import { CompletedSection } from './library/completed_section';
import { NowSection } from './now/now_section';
import { UpNextSection } from './queue/up_next_section';
import { RemoveDialog } from './remove_dialog';
import { sections } from './states';
import { StatusLine } from './status_line';
import { StreamsSection } from './streams/streams_section';
import './downloads.css';

function Notice({ live, error }: { live: boolean; error: string | null }) {
  if (live || !error) return null;
  return <p className="downloads-notice" role="alert">Live updates paused: {error} Reconnecting…</p>;
}

export function DownloadsPage() {
  const { transfers, disks, speed, live, error } = use_transfers();
  const [removing, set_removing] = useState<Transfer | null>(null);
  const { now, up_next, completed, streams } = sections(transfers);

  return <Page title="Downloads">
    <div className="downloads">
      <StatusLine transfers={transfers} disks={disks} speed={speed} />
      <Notice live={live} error={error} />
      {transfers.length ? <>
        <NowSection transfers={now} on_remove={set_removing} />
        <UpNextSection line={up_next} on_remove={set_removing} />
        <CompletedSection transfers={completed} on_remove={set_removing} />
        <StreamsSection transfers={streams} on_remove={set_removing} />
      </> : <EmptyState icon={Download} title="No downloads yet">
        <p>Open a movie or show and choose Download to keep a copy on this server. You can watch while it downloads.</p>
        <a className="button secondary" href="#/movies">Browse movies</a>
      </EmptyState>}
    </div>
    {removing && <RemoveDialog key={removing.id} transfer={removing} on_close={() => set_removing(null)} />}
  </Page>;
}

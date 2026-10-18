import { Download } from 'lucide-react';
import { use_transfers } from '../torrents/transfer_store';
import { EmptyState } from '../ui/empty_state';
import { CacheLine } from './cache/cache_line';
import { DownloadedSection } from './downloaded/downloaded_section';
import { DownloadingSection } from './downloading/downloading_section';
import { ShowScreen } from './show/show_screen';
import { sections } from './states';
import { StatusLine } from './status_line';
import './downloads.css';

function Notice({ live, error }: { live: boolean; error: string | null }) {
  if (live || !error) return null;
  return <p className="downloads-notice" role="alert">Live updates paused: {error} Reconnecting…</p>;
}

function DownloadsList() {
  const { transfers, disks, live, error } = use_transfers();
  const { downloading, downloaded, cached } = sections(transfers);

  return <section className="page page-gutter downloads" aria-labelledby="page-title">
    <header className="downloads-head">
      <h1 id="page-title">Downloads</h1>
      <StatusLine transfers={transfers} disks={disks} />
    </header>
    <Notice live={live} error={error} />
    {downloading.length || downloaded.length ? <>
      <DownloadingSection transfers={downloading} />
      <DownloadedSection transfers={downloaded} />
    </> : <EmptyState icon={Download} title="No downloads yet">
      <p>Open a movie or show and choose Download to keep a copy on this server. You can watch while it downloads.</p>
      <a className="button secondary" href="#/movies">Browse movies</a>
    </EmptyState>}
    <CacheLine cached={cached} />
  </section>;
}

export function DownloadsPage({ show }: { show: string | null }) {
  return show ? <ShowScreen id={show} /> : <DownloadsList />;
}

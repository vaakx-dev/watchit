import { ArrowDownToLine } from 'lucide-react';
import type { SeasonDownloadState } from './use_season_download';

export function DownloadSeasonButton({ download, episodes }: { download: SeasonDownloadState; episodes: number | null }) {
  const { season } = download;
  if (download.downloading) return <a className="button secondary wide" href="#/downloads"><ArrowDownToLine />Season {season} in downloads</a>;
  return <>
    <button type="button" className="button secondary wide" aria-haspopup="dialog" disabled={download.pending} onClick={download.pick}>
      <ArrowDownToLine />Download season {season}
      {episodes !== null && <span className="button-detail">· {episodes === 1 ? '1 episode' : `${episodes} episodes`}</span>}
    </button>
    {download.error && <p className="title-error" role="alert">Download failed: {download.error}</p>}
  </>;
}

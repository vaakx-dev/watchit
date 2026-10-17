import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { use_resource } from '../../catalog/api';
import { FilterPanel } from '../../torrents/filters/filter_panel';
import { FilterToolbar } from '../../torrents/filters/filter_toolbar';
import { use_torrent_filters } from '../../torrents/filters/use_torrent_filters';
import type { TorrentResult, TorrentSearch, Transfer } from '../../torrents/types';
import { use_add_download } from '../../torrents/use_add_download';
import { notify_wanted } from '../notify/notify_choice';
import { NotifySwitch } from '../notify/notify_switch';
import { PickerRow } from './picker_row';

const NO_RESULTS: TorrentResult[] = [];

export type StartDownload = (result: TorrentResult | null, notify_when_ready: boolean) => Promise<Transfer | Transfer[]>;

type Props = {
  heading: string;
  url: string;
  season: boolean;
  start: StartDownload;
  on_close: () => void;
};

export function SourcePicker({ heading, url, season, start, on_close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { resource, retry } = use_resource<TorrentSearch>(url, { cache: false });
  const results = resource.status === 'ready' ? resource.data.results : NO_RESULTS;
  const filters = use_torrent_filters(results, season);
  const [filters_open, set_filters_open] = useState(true);
  const { pending, error, run } = use_add_download(start);
  const best = season ? null : results[0];

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function download(result: TorrentResult | null) {
    if (await run(result, notify_wanted())) dialog.current?.close();
  }

  return <dialog ref={dialog} className="picker-dialog" aria-labelledby="picker-title" onClose={on_close}>
    <header className="picker-head">
      <div>
        <h2 id="picker-title">Choose a source</h2>
        <p className="meta">{heading}</p>
      </div>
      <button type="button" className="icon-button small ghost" aria-label="Close" onClick={() => dialog.current?.close()}><X /></button>
    </header>
    <div className="picker-filters">
      <FilterToolbar state={filters} open={filters_open} on_toggle={() => set_filters_open(!filters_open)} />
      {filters_open && results.length > 0 && <FilterPanel state={filters} />}
    </div>
    <div className="picker-body" aria-busy={resource.status === 'loading'}>
      {resource.status === 'loading' && <p className="picker-note" role="status">Searching Torrentio…</p>}
      {resource.status === 'error' && <p className="picker-note" role="alert">
        Torrent search failed: {resource.error} <button type="button" className="button ghost small" onClick={retry}>Try again</button>
      </p>}
      {resource.status === 'ready' && !results.length && <p className="picker-note">No torrents were found.</p>}
      {results.length > 0 && !filters.shown.length && <p className="picker-note">No results match these filters.</p>}
      {filters.shown.length > 0 && <ul className="picker-rows">
        {filters.shown.map(result => <PickerRow key={`${result.info_hash}/${result.file_index ?? ''}`} result={result} season={season}
          disabled={pending} on_download={() => { void download(result); }} />)}
      </ul>}
    </div>
    <footer className="picker-foot">
      <NotifySwitch />
      {error && <p className="picker-error" role="alert">Download failed: {error}</p>}
      <div className="picker-actions">
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="button primary" disabled={pending || (!season && !best)} onClick={() => { void download(best ?? null); }}>
          <Sparkles />{pending ? 'Starting…' : 'Download best match'}
        </button>
      </div>
    </footer>
  </dialog>;
}

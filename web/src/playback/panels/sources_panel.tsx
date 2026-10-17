import type { ReactNode } from 'react';
import { NotifySwitch } from '../../downloads/notify/notify_switch';
import { bytes, percent } from '../../torrents/format';
import { DownloadResultButton } from '../../torrents/download_result_button';
import type { Sources } from '../sources/use_sources';
import { source_key, type PlaySource } from '../sources/types';
import { RunningNote } from '../../downloads/readiness/running_note';
import { SourceRow } from './source_row';

function Group({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode[] }) {
  return <section className="source-group" aria-label={title}>
    <h3>{title}</h3>
    {children.length > 0 && <ul>{children}</ul>}
    {note}
  </section>;
}

function seeders(count: number | null) {
  return count === null ? null : `${count.toLocaleString()} ${count === 1 ? 'seeder' : 'seeders'}`;
}

function Row({ source, sources, title_id }: { source: PlaySource; sources: Sources; title_id: string }) {
  const current = sources.selected !== undefined && source_key(sources.selected) === source_key(source);
  const play = () => sources.choose(source);
  if (source.kind === 'local') {
    const { file } = source;
    return <SourceRow resolution={file.resolution} hdr={file.hdr} name={file.name} current={current} on_play={play}
      note={file.progress < 1 && <RunningNote info_hash={file.info_hash} />}
      details={[bytes(file.size_bytes), file.progress < 1 && `Downloading ${percent(file.progress)}`]} />;
  }
  if (source.kind === 'torrent') {
    const { result } = source;
    return <SourceRow resolution={result.resolution} hdr={result.hdr} name={result.filename ?? result.name} current={current} on_play={play}
      note={<RunningNote info_hash={result.info_hash} />}
      details={[seeders(result.seeders), result.size_bytes !== null && bytes(result.size_bytes), result.video_codec, result.audio, result.site, result.languages.join(' / ')]}
      action={<DownloadResultButton result={result} title_id={title_id} />} />;
  }
  return <li className="source-row">
    <button type="button" className="source-play" aria-current={current || undefined} onClick={play}>
      <span className="source-copy"><span className="source-name">{source.provider.name}</span></span>
    </button>
  </li>;
}

function TorrentNote({ sources }: { sources: Sources }) {
  if (sources.search_error) return <p className="watch-note" role="alert">
    Torrent search failed: {sources.search_error} <button type="button" className="button ghost small" onClick={sources.retry}>Try again</button>
  </p>;
  if (sources.searching) return <p className="watch-note" role="status">Searching for torrents…</p>;
  if (!sources.torrents.length) return <p className="watch-note">No torrents were found for this title.</p>;
  return null;
}

export function SourcesPanel({ sources, title_id }: { sources: Sources; title_id: string }) {
  const rows = (list: PlaySource[]) => list.map(source => <Row key={source_key(source)} source={source} sources={sources} title_id={title_id} />);
  return <div className="sources-panel">
    {sources.local.length > 0 && <Group title="On this server">{rows(sources.local)}</Group>}
    <NotifySwitch />
    <Group title="Torrents" note={<TorrentNote sources={sources} />}>{rows(sources.torrents)}</Group>
    {sources.embeds.length > 0 && <Group title="Embedded players">{rows(sources.embeds)}</Group>}
    <p className="watch-note" role={sources.save_error ? 'alert' : undefined}>
      {sources.save_error ? `Your source choice wasn't saved: ${sources.save_error}` : 'Your choice is remembered for this title.'}
    </p>
  </div>;
}

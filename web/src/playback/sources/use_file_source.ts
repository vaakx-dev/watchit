import { useEffect, useState } from 'react';
import { notify_wanted } from '../../downloads/notify/notify_choice';
import { add_transfer } from '../../torrents/api';
import { upsert_transfer, use_transfers } from '../../torrents/transfer_store';
import type { Transfer } from '../../torrents/types';
import type { FileSource } from '../session/types';
import { source_key, type PlaySource } from './types';

type Started = { key: string; transfer_id: string | null; error: string | null };

function title_file(transfer: Transfer, title_id: string) {
  const files = transfer.files.filter(file => file.title_id === title_id);
  return [...(files.length ? files : transfer.files)].sort((a, b) => b.size_bytes - a.size_bytes)[0]?.index ?? null;
}

export function use_file_source(title_id: string, source: PlaySource) {
  const { transfers } = use_transfers();
  const [started, set_started] = useState<Started | null>(null);
  const key = source_key(source);
  const result = source.kind === 'torrent' ? source.result : null;

  useEffect(() => {
    if (!result) return;
    let current = true;
    add_transfer(result.info_hash, result.file_index === null ? null : [result.file_index], title_id, 'stream', notify_wanted())
      .then(transfer => {
        upsert_transfer(transfer);
        if (current) set_started({ key, transfer_id: transfer.id, error: null });
      })
      .catch((cause: unknown) => {
        if (current) set_started({ key, transfer_id: null, error: cause instanceof Error ? cause.message : 'The server did not respond.' });
      });
    return () => { current = false; };
  }, [key, title_id]);

  const info_hash = source.kind === 'local' ? source.file.info_hash : result?.info_hash;
  const transfer = transfers.find(item => item.info_hash === info_hash) ?? null;
  const ready = started?.key === key ? started : null;
  let file: FileSource | null = null;
  if (source.kind === 'local') file = { info_hash: source.file.info_hash, file_index: source.file.file_index };
  else if (result && ready?.transfer_id) {
    const index = result.file_index ?? (transfer ? title_file(transfer, title_id) : null);
    if (index !== null) file = { info_hash: result.info_hash, file_index: index };
  }

  return { file, transfer, error: ready?.error ?? null };
}

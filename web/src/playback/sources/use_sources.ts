import { useState } from 'react';
import { use_resource } from '../../catalog/api';
import { send } from '../../catalog/client';
import { TITLE_ID } from '../../catalog/identity';
import type { Title } from '../../catalog/types';
import type { PlaybackPreference } from '../../library/types';
import { local_files_url, search_url } from '../../torrents/api';
import type { LocalFile, TorrentResult } from '../../torrents/types';
import { PROVIDERS, pick_provider } from '../providers';
import { preference, source_key, TORRENT_PREFERENCE, type PlaySource } from './types';

type Embed = Extract<PlaySource, { kind: 'embed' }>;

function local_sources(files: readonly LocalFile[]): PlaySource[] {
  return [...files].sort((a, b) => b.progress - a.progress).map(file => ({ kind: 'local', file }));
}

function pick_embed(embeds: readonly Embed[], remembered: string | null) {
  const provider = pick_provider(embeds.map(embed => embed.provider), remembered);
  return embeds.find(embed => embed.provider === provider);
}

function failure(...resources: ({ status: string } & { error?: string })[]) {
  return resources.find(resource => resource.status === 'error')?.error ?? null;
}

export function use_sources(title: Title, remembered: string | null) {
  const searchable = TITLE_ID.test(title.id);
  const files = use_resource<{ files: LocalFile[] }>(searchable ? local_files_url(title.id) : null, { cache: false });
  const search = use_resource<{ results: TorrentResult[] }>(searchable ? search_url(title.id) : null, { cache: false });
  const [chosen, set_chosen] = useState<string | null>(null);
  const [save_error, set_save_error] = useState<string | null>(null);

  const local = files.resource.status === 'ready' ? local_sources(files.resource.data.files) : [];
  const torrents: PlaySource[] = search.resource.status === 'ready' ? search.resource.data.results.map(result => ({ kind: 'torrent', result })) : [];
  const embeds: Embed[] = PROVIDERS.filter(provider => provider.url(title)).map(provider => ({ kind: 'embed', provider }));
  const searching = searchable && [files.resource, search.resource].some(resource => resource.status === 'loading');
  const wanted_embed = remembered === TORRENT_PREFERENCE ? undefined : embeds.find(embed => embed.provider.id === remembered);
  const automatic = wanted_embed ?? (searching ? undefined : local[0] ?? torrents[0] ?? pick_embed(embeds, null));
  const selected = [...local, ...torrents, ...embeds].find(source => source_key(source) === chosen) ?? automatic;

  function choose(source: PlaySource) {
    set_chosen(source_key(source));
    set_save_error(null);
    send<PlaybackPreference>(`/api/library/${encodeURIComponent(title.id)}/playback`, 'PATCH', { source: preference(source) })
      .catch((cause: unknown) => set_save_error(cause instanceof Error ? cause.message : 'The server did not respond.'));
  }

  return {
    local,
    torrents,
    embeds,
    selected,
    searching,
    search_error: failure(search.resource),
    save_error,
    choose,
    retry: search.retry,
  };
}

export type Sources = ReturnType<typeof use_sources>;

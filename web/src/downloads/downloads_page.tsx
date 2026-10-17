import { Download } from 'lucide-react';
import { useState } from 'react';
import { use_transfers } from '../torrents/transfer_store';
import type { Transfer } from '../torrents/types';
import { Choices } from '../ui/choices';
import { EmptyState } from '../ui/empty_state';
import { Page } from '../ui/page';
import { SpeedMode } from './bandwidth/speed_mode';
import { QueueSection } from './queue/queue_section';
import { RemoveDialog } from './remove_dialog';
import { SettingsSection } from './settings/settings_section';
import { FILTER_LABELS, FILTERS, matches, type Filter } from './states';
import { Summary } from './summary';
import { group_id, TransferGroup } from './transfer_group';

function groups(transfers: Transfer[]) {
  const map = new Map<string, Transfer[]>();
  for (const transfer of transfers) map.set(group_id(transfer), [...map.get(group_id(transfer)) ?? [], transfer]);
  return [...map];
}

function Notice({ live, error }: { live: boolean; error: string | null }) {
  if (live || !error) return null;
  return <p className="downloads-notice" role="alert">Live updates paused: {error} Reconnecting…</p>;
}

export function DownloadsPage() {
  const { transfers, disks, speed, live, error } = use_transfers();
  const [filter, set_filter] = useState<Filter>('all');
  const [removing, set_removing] = useState<Transfer | null>(null);
  const shown = transfers.filter(transfer => matches(transfer, filter));
  const options = FILTERS.map(value => ({ value, label: FILTER_LABELS[value], count: transfers.filter(transfer => matches(transfer, value)).length }));

  return <Page title="Downloads">
    <div className="downloads">
      <Summary transfers={transfers} disks={disks} />
      <SpeedMode speed={speed} />
      <Notice live={live} error={error} />
      <QueueSection transfers={transfers} />
      <Choices label="Show downloads" options={options} value={filter} on_change={set_filter} />
      {shown.length ? groups(shown).map(([id, list]) => <TransferGroup key={id} id={id} transfers={list} on_remove={set_removing} />)
        : <EmptyState icon={Download} title={filter === 'all' ? 'Nothing downloaded yet.' : `No ${FILTER_LABELS[filter].toLowerCase()} downloads.`}>
          {filter === 'all' && <p>Use Download on a movie or episode, or Download season on a series, to keep a copy on this server.</p>}
        </EmptyState>}
      <SettingsSection />
    </div>
    {removing && <RemoveDialog key={removing.id} transfer={removing} on_close={() => set_removing(null)} />}
  </Page>;
}

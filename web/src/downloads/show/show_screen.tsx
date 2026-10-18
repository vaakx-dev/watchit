import { useState } from 'react';
import { ChevronLeft, Download } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import { season_label } from '../../catalog/episodes';
import { bytes } from '../../torrents/format';
import { use_transfers } from '../../torrents/transfer_store';
import { Choices } from '../../ui/choices';
import { EmptyState } from '../../ui/empty_state';
import { show_group, shows_by_id, type ShowGroup } from '../downloaded/library_groups';
import { count, episode_count } from '../downloaded/show_summary';
import { sections } from '../states';
import { use_title_details } from '../titles';
import { EpisodeRow } from './episode_row';

function season_choices(show: ShowGroup, selected: number) {
  return show.seasons.map(shelf => ({
    value: String(shelf.season),
    label: shelf.season === selected ? season_label(shelf.season) : `${season_label(shelf.season)} · ${count(shelf.episodes.length, 'episode', 'episodes')}`,
  }));
}

function Episodes({ show, artwork }: { show: ShowGroup; artwork: string }) {
  const [season, set_season] = useState<number | null>(null);
  const shelf = show.seasons.find(item => item.season === season) ?? show.seasons[0];
  if (!shelf) return null;
  return <>
    <Choices label="Season" look="chips" value={String(shelf.season)} options={season_choices(show, shelf.season)}
      on_change={value => set_season(Number(value))} />
    <ul className="download-list show-episodes">
      {shelf.episodes.map(copy => <EpisodeRow key={`${copy.transfer.id}:${copy.id}`} copy={copy} artwork={artwork} />)}
    </ul>
  </>;
}

export function ShowScreen({ id }: { id: string }) {
  const { transfers } = use_transfers();
  const title = use_title_details(id);
  const list = shows_by_id(sections(transfers).downloaded).get(id);
  const show = list ? show_group(id, list) : null;
  const name = title?.title ?? list?.[0]?.name ?? '';
  const artwork = title?.artwork ?? '';

  return <section className="page page-gutter downloads" aria-labelledby="page-title">
    <a className="downloads-back" href="#/downloads"><ChevronLeft />Downloads</a>
    <header className="show-head">
      <a className="show-poster" href={`#/title/${id}`} tabIndex={-1} aria-hidden="true"><Artwork src={artwork} label={name} /></a>
      <div>
        <h1 id="page-title">{name}</h1>
        {show && <p className="show-summary">{episode_count(show)} · {bytes(show.size)}</p>}
      </div>
    </header>
    {show ? <Episodes show={show} artwork={artwork} /> : <EmptyState icon={Download} title="Nothing from this show is downloaded" />}
  </section>;
}

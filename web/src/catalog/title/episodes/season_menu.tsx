import { useId, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { season_label } from '../../episodes';
import type { EpisodeNavigation, Title } from '../../types';
import type { SeasonDownloadState } from '../../../downloads/actions/use_season_download';
import { RatingControl } from '../../../library/components/rating';
import { season_watched } from '../../../library/components/season_watched';
import type { Library } from '../../../library/use_library';
import { Sheet } from '../../../ui/sheet/sheet';

type Props = { series: Title; navigation: EpisodeNavigation; download: SeasonDownloadState; library: Library };

function SeasonRating({ series, season, library }: { series: Title; season: number; library: Library }) {
  return <div className="season-rating">
    <RatingControl title={`${series.title} ${season_label(season)}`} value={library.seasons[series.id]?.[season] ?? null}
      disabled={!library.ready} on_change={rating => library.update_season(series.id, season, rating)} />
  </div>;
}

export function SeasonMenu({ series, navigation, download, library }: Props) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);
  const [rating, set_rating] = useState(false);
  const { season } = download;
  const loaded = navigation.season === season && navigation.items.length > 0;
  const watched = season_watched(series.id, navigation, library);

  function close() {
    set_open(false);
    set_rating(false);
  }

  function run(action: () => void) {
    close();
    action();
  }

  return <>
    <button type="button" className="icon-button ghost season-more" ref={anchor} popoverTarget={id} aria-controls={id} aria-expanded={open}
      aria-label={`${season_label(season)} actions`} onClick={event => { event.preventDefault(); set_open(!open); }}><Ellipsis /></button>
    <Sheet id={id} title={rating ? `Rate ${season_label(season).toLowerCase()}` : season_label(season)} open={open} anchor={anchor} on_close={close}
      className="season-sheet">
      {rating ? <SeasonRating series={series} season={season} library={library} /> : <div className="sheet-options" role="group" aria-label={`${season_label(season)} actions`}>
        {loaded && <button type="button" className="sheet-option" disabled={!library.ready} onClick={() => run(watched.toggle)}>{watched.label}</button>}
        <button type="button" className="sheet-option" disabled={download.downloading || download.pending} onClick={() => run(download.download_best)}>
          {download.downloading ? 'Season in downloads' : 'Download season'}
        </button>
        <button type="button" className="sheet-option" onClick={() => set_rating(true)}>Rate {season_label(season).toLowerCase()}</button>
        <hr className="sheet-rule" />
        <button type="button" className="sheet-option" onClick={() => run(download.pick)}>Choose source…</button>
      </div>}
    </Sheet>
  </>;
}

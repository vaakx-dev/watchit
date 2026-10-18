import { ImdbScore } from '../components/imdb_score';
import { episode_code } from '../episodes';
import { runtime } from '../format';
import type { Title } from '../types';

const GENRES = 3;

export function TitleMeta({ title, seasons }: { title: Title; seasons: number }) {
  return <div className="meta title-meta">
    {title.kind === 'episode' && <span>{episode_code(title)}</span>}
    {title.year && <span>{title.year}</span>}
    {seasons > 0 && <span>{seasons === 1 ? '1 season' : `${seasons} seasons`}</span>}
    {title.minutes && <span>{runtime(title.minutes)}</span>}
    <ImdbScore score={title.imdb_rating} />
    {title.genres.length > 0 && <span>{title.genres.slice(0, GENRES).join(', ')}</span>}
  </div>;
}

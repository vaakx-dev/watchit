import { useState } from 'react';
import type { CatalogEntry } from '../../catalog/types';
import { Artwork } from '../../catalog/components/artwork';
import { use_long_press } from '../../ui/use_long_press';
import { StatusMore } from '../components/status_more';
import { TitleRating } from '../components/title_rating';
import { use_status_menu } from '../components/use_status_menu';
import type { LibraryItem, Shelf } from '../types';
import type { Library } from '../use_library';
import { length_line } from './row_lines';

function CardRating({ title, library }: { title: CatalogEntry; library: Library }) {
  const [rating, set_rating] = useState(false);
  const rated = library.entries[title.id]?.rating != null;
  if (!rated && !rating) return <button type="button" className="myshows-rate" disabled={!library.ready}
    aria-label={`Rate ${title.title}`} onClick={() => set_rating(true)}>Rate</button>;
  return <div className="myshows-stars"><TitleRating title={title} library={library} /></div>;
}

export function LibraryCard({ item, shelf, library }: { item: LibraryItem; shelf: Shelf; library: Library }) {
  const { title } = item;
  const menu = use_status_menu(title, library);
  const press = use_long_press(menu.show);

  return <li className="myshows-card" {...press}>
    <a className="card-link" href={`#/title/${title.id}`} title={title.title}>
      <div className="card-image"><Artwork src={title.artwork} label={title.title} /></div>
      <h3>{title.title}</h3>
    </a>
    {shelf === 'watched' ? <CardRating title={title} library={library} /> : <p className="card-meta">{length_line(item)}</p>}
    <div className="myshows-card-more"><StatusMore menu={menu} title={title.title} /></div>
    {menu.panel}
  </li>;
}

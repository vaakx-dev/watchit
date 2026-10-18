import { ChevronLeft } from 'lucide-react';
import { Backdrop } from '../components/backdrop';
import { came_from } from '../../navigation/came_from';
import { discover_route } from '../../navigation/route';
import type { Title } from '../types';

function BackButton({ title }: { title: Title }) {
  const icon = <ChevronLeft />;
  if (title.series) return <a className="title-back" href={`#/title/${title.series.id}`} aria-label={`Back to ${title.series.title}`}>{icon}</a>;
  const previous = came_from();
  if (previous) return <button type="button" className="title-back" aria-label={`Back to ${previous.label}`} onClick={() => window.history.back()}>{icon}</button>;
  const kind = title.anime ? 'anime' : title.kind === 'movie' ? 'movie' : 'series';
  return <a className="title-back" href={discover_route(kind)} aria-label="Back to Discover">{icon}</a>;
}

export function TitleBackdrop({ title }: { title: Title }) {
  return <div className={`title-backdrop${title.backdrop ? '' : ' blurred'}`}>
    <Backdrop src={title.backdrop || title.artwork} />
    <BackButton title={title} />
  </div>;
}

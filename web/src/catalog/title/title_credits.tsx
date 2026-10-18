import type { Title } from '../types';

const STARRING = 3;

export function TitleCredits({ title }: { title: Title }) {
  const starring = title.cast.split(',').map(name => name.trim()).filter(Boolean).slice(0, STARRING).join(', ');
  if (!title.director && !starring) return null;
  return <p className="title-credits">
    {title.director && <span><b>Director</b> {title.director}</span>}
    {starring && <span><b>Starring</b> {starring}</span>}
  </p>;
}

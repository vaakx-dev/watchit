export function ImdbScore({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  return <span className="imdb" aria-label={`IMDb ${score.toFixed(1)}`}>{score.toFixed(1)}</span>;
}

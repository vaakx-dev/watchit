export function ResultsSkeleton() {
  return <div role="status" aria-label="Searching">
    <ol className="result-rows" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <li className="result-row" key={index}>
      <span className="result-poster skeleton-block" />
      <span className="result-copy"><span className="skeleton-line" /><span className="skeleton-line" /></span>
    </li>)}</ol>
  </div>;
}

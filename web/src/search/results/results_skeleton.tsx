export function ResultsSkeleton() {
  return <div role="status" aria-label="Searching">
    <div className="result-rows" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="result-row" key={index}>
      <span className="result-poster skeleton-block" />
      <span className="result-copy"><span className="skeleton-line" /><span className="skeleton-line" /></span>
    </div>)}</div>
  </div>;
}

export function PageRetry({ error, retry }: { error: string; retry: () => void }) {
  return <div className="page-retry" role="alert">
    <p>{error}</p>
    <button type="button" className="button secondary small" onClick={retry}>Try again</button>
  </div>;
}

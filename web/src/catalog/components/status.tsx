export function CatalogStatus({ error, retry, message = 'Loading the local catalog.' }: { error?: string; retry?: () => void; message?: string }) {
  return (
    <div className="catalog-status" role={error ? 'alert' : 'status'}>
      <p>{error ?? message}</p>
      {error && retry && <button className="button secondary" onClick={retry}>Try again</button>}
    </div>
  );
}

export function QueueNumber({ place }: { place: number }) {
  return <span className="queue-number" aria-label={`Number ${place} in the queue`}>{place}</span>;
}

import { Eye } from '../ui/eye';

export function Brand() {
  return <span className="brand" role="img" aria-label="Watchit">
    <span aria-hidden="true">WATCH</span><Eye pupil="it-b" />
  </span>;
}

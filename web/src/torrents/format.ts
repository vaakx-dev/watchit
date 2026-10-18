const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function bytes(value: number) {
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${UNITS[unit]}`;
}

export function speed(bps: number) {
  return `${bytes(bps)}/s`;
}

export function percent(progress: number) {
  return `${Math.floor(Math.min(Math.max(progress, 0), 1) * 100)}%`;
}

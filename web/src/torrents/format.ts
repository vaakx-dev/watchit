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

export function eta(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${total % 60}s`;
  return `${total}s`;
}

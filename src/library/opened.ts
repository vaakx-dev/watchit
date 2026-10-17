const DAY = 86_400_000;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function midnight(time: Date) {
  return new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
}

export function opened_ago(opened_at: string, now = new Date()) {
  const days = Math.max(0, Math.round((midnight(now) - midnight(new Date(opened_at))) / DAY));
  if (days < 7) return relative.format(-days, 'day');
  if (days < 30) return relative.format(-Math.round(days / 7), 'week');
  if (days < 365) return relative.format(-Math.round(days / 30), 'month');
  return relative.format(-Math.round(days / 365), 'year');
}

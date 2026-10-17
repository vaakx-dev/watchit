const KEY = 'watchit:volume';

export function saved_volume() {
  const value = Number(localStorage.getItem(KEY));
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : 100;
}

export function remember_volume(volume: number) {
  if (volume > 0) localStorage.setItem(KEY, String(Math.round(volume)));
}

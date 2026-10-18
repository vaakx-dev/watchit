const COLORS: Record<string, string> = {
  action: '#4a1d24',
  adventure: '#3d2f15',
  animation: '#203a2a',
  comedy: '#3b2a12',
  crime: '#2b1f3d',
  documentary: '#1f2a3d',
  drama: '#33213a',
  fantasy: '#16323a',
  horror: '#3a1616',
  'science-fiction': '#162a44',
  thriller: '#2c2c16',
  romance: '#3a1f30',
};

const PALETTE = Object.values(COLORS);

export function genre_color(id: string) {
  const known = COLORS[id];
  if (known) return known;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % PALETTE.length;
  return PALETTE[hash];
}

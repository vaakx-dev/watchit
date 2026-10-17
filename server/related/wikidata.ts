import { IMDB_ID } from '../../src/catalog/identity.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'Watchit/1.0 (personal app; no API key)';
const TIMEOUT_MS = 20000;
const CHAIN_REACH = 4;

export type Franchise = { name: string | null; ids: string[] };
export type FranchiseRow = { series?: string; name?: string; imdb: string; ordinal?: string; date?: string };
type Binding = Record<string, { value: string } | undefined>;
type Member = { imdb: string; ordinal: number; date: string };

function query(imdb_id: string) {
  const neighbours = [1, 2, 3, 4].flatMap(steps => ['P155', 'P156'].map(property => Array(steps).fill(`wdt:${property}`).join('/'))).join('|');
  return `SELECT ?series ?name ?imdb (SAMPLE(?position) AS ?ordinal) (MIN(?published) AS ?date) WHERE {
    hint:Query hint:optimizer "None" .
    ?item wdt:P345 "${imdb_id}" .
    {
      ?item wdt:P179 ?series . ?statement ps:P179 ?series . ?member p:P179 ?statement .
      OPTIONAL { ?statement pq:P1545 ?position }
      OPTIONAL { ?series rdfs:label ?name FILTER(LANG(?name) = "en") }
    } UNION { ?item ${neighbours} ?member } UNION { ?item wdt:P345 ?own . BIND(?item AS ?member) }
    ?member wdt:P345 ?imdb .
    OPTIONAL { ?member wdt:P577 ?published }
  } GROUP BY ?series ?name ?imdb`;
}

function by_order(left: Member, right: Member) {
  return left.ordinal - right.ordinal || left.date.localeCompare(right.date) || left.imdb.localeCompare(right.imdb);
}

function members(rows: readonly FranchiseRow[]): Member[] {
  const unique = new Map<string, Member>();
  for (const row of rows) {
    if (!IMDB_ID.test(row.imdb) || unique.has(row.imdb)) continue;
    const ordinal = Number.parseFloat(row.ordinal ?? '');
    unique.set(row.imdb, { imdb: row.imdb, ordinal: Number.isFinite(ordinal) ? ordinal : Infinity, date: row.date ?? '9999' });
  }
  return [...unique.values()].sort(by_order);
}

function smallest_series(id: string, rows: readonly FranchiseRow[]): Franchise | null {
  const groups = new Map<string, FranchiseRow[]>();
  for (const row of rows) if (row.series) groups.set(row.series, [...groups.get(row.series) ?? [], row]);
  const candidates = [...groups.values()].map(group => ({ name: group[0]!.name ?? null, list: members(group) }))
    .filter(({ list }) => list.length > 1 && list.some(member => member.imdb === id))
    .sort((left, right) => left.list.length - right.list.length);
  const chosen = candidates[0];
  return chosen ? { name: chosen.name, ids: chosen.list.map(member => member.imdb) } : null;
}

function chain(id: string, rows: readonly FranchiseRow[]): Franchise {
  const list = members(rows.filter(row => !row.series));
  if (list.length < 2) return { name: null, ids: [] };
  const index = list.findIndex(member => member.imdb === id);
  return { name: null, ids: list.slice(Math.max(0, index - CHAIN_REACH), index + CHAIN_REACH + 1).map(member => member.imdb) };
}

export function franchise_order(id: string, rows: readonly FranchiseRow[]): Franchise {
  return smallest_series(id, rows) ?? chain(id, rows);
}

export async function fetch_franchise(imdb_id: string, signal: AbortSignal): Promise<Franchise> {
  const url = `${ENDPOINT}?${new URLSearchParams({ query: query(imdb_id) })}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!response.ok) throw new Error(`Wikidata answered ${response.status}.`);
  const body = await response.json() as { results: { bindings: Binding[] } };
  const rows = body.results.bindings.map(binding => ({
    series: binding.series?.value, name: binding.name?.value, imdb: binding.imdb?.value ?? '',
    ordinal: binding.ordinal?.value, date: binding.date?.value,
  }));
  return franchise_order(imdb_id, rows);
}

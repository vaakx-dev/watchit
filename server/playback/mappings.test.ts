import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Title } from '../../src/catalog/types.ts';
import { with_provider_ids } from './mappings.ts';

const title: Title = {
  id: 'tt0877057:1:1', title: 'Example episode', year: null, artwork: '', genres: [], kind: 'episode', anime: true,
  backdrop: '', minutes: null, synopsis: '', director: '', cast: '', imdb_id: null, tmdb_id: null,
  season: null, episode: null, series: null, related: [], images: [], source_url: 'https://v3-cinemeta.strem.io/meta/series/tt0877057.json',
};
let directory: string;

beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'streamit-mappings-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

it('leaves unmapped titles unchanged and applies only their explicit mapping', async () => {
  expect(await with_provider_ids(title, directory)).toBe(title);
  const token = '0123456789abcdef0123456789abcdef';
  await writeFile(join(directory, 'providers.json'), JSON.stringify({ 'tt0877057:1:1': { one_anime: token } }));
  expect((await with_provider_ids(title, directory)).provider_ids?.one_anime).toBe(token);
  expect(await with_provider_ids({ ...title, id: 'tt0877057:1:2' }, directory)).not.toHaveProperty('provider_ids');
});

it('rejects URLs and malformed tokens instead of building arbitrary player URLs', async () => {
  await writeFile(join(directory, 'providers.json'), JSON.stringify({ 'tt0877057:1:1': { one_anime: 'https://example.com/video' } }));
  await expect(with_provider_ids(title, directory)).rejects.toThrow('Invalid 1Anime mapping');
});

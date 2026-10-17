import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageCredit, Title } from '../../src/catalog/types.ts';
import { create_attribution } from './index.ts';
import { read_json } from './files.ts';
import type { ImageRecord } from './records.ts';
import { README } from './readme.ts';

const key = 'a'.repeat(64);
const url = `/api/images/${key}`;
const credit: ImageCredit = {
  url, source: 'cinemeta', role: 'poster', source_url: 'https://images.metahub.space/poster/small/tt0000001/img',
  description_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0000001.json', author: 'Example author',
  license: '', license_url: '',
  terms_url: 'https://www.metahub.space/terms',
  retrieved_at: '2026-01-02T03:04:05.000Z',
};
function title(id = 'tt0000001', patch: Partial<Title> = {}): Title {
  return {
    id, title: 'Example', year: 2024, artwork: url, backdrop: url, genres: ['Drama'], kind: 'movie',
    anime: false, minutes: 90, synopsis: 'Description', director: 'Director', cast: 'Actor',
    imdb_id: 'tt0000001', tmdb_id: 123, season: null, episode: null, series: null, related: [],
    images: [credit], source_url: `https://v3-cinemeta.strem.io/meta/movie/${id}.json`, ...patch,
  };
}
let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'streamit-attribution-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

async function image_record(image_key = key) {
  return (await read_json<ImageRecord>(join(directory, 'images', `${image_key}.json`)))!;
}

describe('attribution archive', () => {
  it('writes public metadata, canonical provenance, image credits, and an explanatory README', async () => {
    const archive = create_attribution(directory);
    const item = { ...title(), source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0000001.json?token=secret',
      provider_ids: { one_anime: 'private-provider' }, rating: 4, watched: true, saved: true,
      last_opened_at: 'private-time', playback_url: 'private-playback', headers: { Authorization: 'private-auth' } };
    await archive.record(item);
    const text = await readFile(join(directory, 'titles', 'tt0000001.json'), 'utf8');
    expect(text).toContain('\n  "id": "tt0000001",\n');
    expect(JSON.parse(text)).toMatchObject({ id: 'tt0000001', metadata: {
      source: 'cinemeta', source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0000001.json', license: null,
      license_url: null,
      title: 'Example', year: 2024, synopsis: 'Description', director: 'Director', cast: 'Actor',
    }, images: [{ key, url }] });
    for (const forbidden of ['provider_ids', 'private-', 'rating', 'watched', 'saved', 'last_opened_at', 'headers', 'token']) {
      expect(text).not.toContain(forbidden);
    }
    const image = await image_record();
    const { url: _url, ...supplied_credit } = credit;
    const expected_credit = { ...supplied_credit, license: null, license_url: null };
    expect(image).toMatchObject({ key, url, title_ids: ['tt0000001'], credits: [expected_credit] });
    expect(image.first_recorded_at).toMatch(/^\d{4}-/);
    expect(image.last_recorded_at).toBe(image.first_recorded_at);
    expect(await readFile(join(directory, 'README.md'), 'utf8')).toBe(README);
    expect((await readdir(directory)).sort()).toEqual(['README.md', 'images', 'manual', 'titles']);
  });

  it('drains queued export records during shutdown', async () => {
    const archive = create_attribution(directory);
    const first = archive.enqueue(title('tt0000001'));
    const second = archive.enqueue(title('tt0000002'));
    await archive.stop();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(await readdir(join(directory, 'titles'))).toEqual(['tt0000001.json', 'tt0000002.json']);
  });

  it('coalesces queued exports to the latest snapshot of each title', async () => {
    const archive = create_attribution(directory);
    const first = archive.enqueue(title('tt0000001'));
    const second = archive.enqueue(title('tt0000002', { title: 'Old' }));
    const third = archive.enqueue(title('tt0000002', { title: 'New' }));
    expect(second).toBe(third);
    await archive.stop();
    await expect(Promise.all([first, second, third])).resolves.toEqual([undefined, undefined, undefined]);
    expect(await read_json(join(directory, 'titles', 'tt0000002.json'))).toMatchObject({ metadata: { title: 'New' } });
  });

  it('skips unchanged files and updates retrieval times of repeated credits in place', async () => {
    const archive = create_attribution(directory);
    await archive.record(title());
    const original = await image_record();
    const snapshot = await readFile(join(directory, 'titles', 'tt0000001.json'), 'utf8');
    await new Promise(resolve => setTimeout(resolve, 5));
    await archive.record(title());
    expect(await image_record()).toEqual(original);
    expect(await readFile(join(directory, 'titles', 'tt0000001.json'), 'utf8')).toBe(snapshot);
    const retrieved_at = '2026-02-03T00:00:00.000Z';
    await archive.record(title('tt0000001', { images: [{ ...credit, retrieved_at }] }));
    const updated = await image_record();
    expect(updated.credits).toEqual([{ ...original.credits[0], retrieved_at }]);
    expect(updated.last_recorded_at > original.last_recorded_at).toBe(true);
  });

  it('removes leftover temporary files before writing', async () => {
    await mkdir(join(directory, 'images'), { recursive: true });
    await writeFile(join(directory, 'images', `${key}.json.interrupted.tmp`), '{');
    await writeFile(join(directory, 'README.md.interrupted.tmp'), '');
    await create_attribution(directory).record(title());
    expect(await readdir(directory, { recursive: true })).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.tmp$/)]));
  });

  it('records Cinemeta provenance and uses portable episode filenames', async () => {
    const archive = create_attribution(directory);
    const id = 'tt0903747:1:2';
    await archive.record(title(id, {
      kind: 'episode', imdb_id: null, season: 1, episode: 2,
      source_url: 'https://v3-cinemeta.strem.io/meta/series/tt0903747.json',
      images: [{ ...credit, source: 'cinemeta', source_url: 'https://images.metahub.space/poster/small/tt0903747/img',
        author: '', license: '', license_url: '' }],
    }));
    expect(await readdir(join(directory, 'titles'))).toEqual(['tt0903747%3A1%3A2.json']);
    expect(await read_json(join(directory, 'titles', `${encodeURIComponent(id)}.json`))).toMatchObject({
      id, metadata: { source: 'cinemeta', source_url: 'https://v3-cinemeta.strem.io/meta/series/tt0903747.json',
        license: null, license_url: null, season: 1, episode: 2 },
    });
    expect((await image_record()).credits[0]).toMatchObject({ source: 'cinemeta', license: null });
  });

  it('rejects unsafe and noncanonical title IDs before writing files', async () => {
    const archive = create_attribution(directory);
    for (const id of ['invalid', 'tt123', 'TT1234567', '../tt0000001', 'tt0000001/../../escape', 'tt0000001.json', 'tt0000001\n', 'tt0000001\\escape', '']) {
      await expect(archive.record(title(id))).rejects.toThrow(RangeError);
    }
    expect(await readdir(directory)).toEqual([]);
    await archive.record(title('tt123456789012'));
    expect(await readdir(join(directory, 'titles'))).toEqual(['tt123456789012.json']);
  });

  it('merges shared-image references under concurrent writes and deduplicates repeated credits', async () => {
    const first = create_attribution(directory);
    const second = create_attribution(join(directory, '.'));
    await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).record(title(`tt${String(index + 1).padStart(7, '0')}`))));
    await first.record(title());
    expect(await readdir(join(directory, 'images'))).toEqual([`${key}.json`]);
    const image = await image_record();
    expect(image.title_ids).toEqual(Array.from({ length: 12 }, (_, index) => `tt${String(index + 1).padStart(7, '0')}`).sort());
    expect(image.credits).toHaveLength(1);
    expect(await readdir(directory, { recursive: true })).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.tmp$/)]));
  });

  it('keeps old images, references, and changed credit observations after replacement and reopen', async () => {
    const archive = create_attribution(directory);
    await archive.record(title());
    const original = await image_record();
    const replacement_key = 'b'.repeat(64);
    const replacement_url = `/api/images/${replacement_key}`;
    await archive.record(title('tt0000001', { artwork: replacement_url, backdrop: '',
      images: [{ ...credit, url: replacement_url, role: 'still' }] }));
    expect(await image_record()).toEqual(original);
    expect(await image_record(replacement_key)).toMatchObject({ title_ids: ['tt0000001'], credits: [{ role: 'still' }] });
    const reopened = create_attribution(directory);
    await reopened.record(title('tt0000002', { images: [{ ...credit, author: 'Corrected author', role: 'backdrop' }] }));
    expect(await image_record()).toMatchObject({ title_ids: ['tt0000001', 'tt0000002'], first_recorded_at: original.first_recorded_at,
      credits: [{ author: 'Example author', role: 'poster' }, { author: 'Corrected author', role: 'backdrop' }] });
    await reopened.record(title('tt0000001', { artwork: '', backdrop: '', images: [] }));
    expect(await readdir(join(directory, 'images'))).toHaveLength(2);
    expect(await read_json(join(directory, 'titles', 'tt0000001.json'))).toMatchObject({ images: [] });
  });

  it('records unknown credits honestly and omits invalid local image paths', async () => {
    const archive = create_attribution(directory);
    await archive.record(title('tt0000001', { images: [{ url, author: '', license: '', license_url: '', description_url: '' }] }));
    expect((await image_record()).credits).toEqual([{
      source: null, role: null, source_url: null, description_url: null, author: null,
      license: null, license_url: null, terms_url: null, retrieved_at: null,
    }]);
    await archive.record(title('tt0000002', { images: [] }));
    expect((await image_record()).title_ids).toEqual(['tt0000001', 'tt0000002']);
    const invalid = ['https://external.example/image', '/api/images/../escape', `${url}\n`, `/api/images/${'A'.repeat(64)}`];
    await archive.record(title('tt0000003', { artwork: invalid[0], backdrop: invalid[1], images: invalid.map(value => ({ ...credit, url: value })) }));
    expect(await readdir(join(directory, 'images'))).toEqual([`${key}.json`]);
    expect(await read_json(join(directory, 'titles', 'tt0000003.json'))).toMatchObject({ artwork: null, backdrop: null, images: [] });
  });

  it('deduplicates versioned local paths and records supplied artwork without inventing a license', async () => {
    const archive = create_attribution(directory);
    const image: ImageCredit = { url: `${url}?v=123`, source: 'cinemeta', role: 'poster',
      source_url: 'https://images.metahub.space/poster/small/tt0000001/img', description_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0000001.json',
      author: '', license: '', license_url: '' };
    await archive.record(title('tt0000001', { artwork: `${url}?v=456`, backdrop: '', images: [image] }));
    await archive.record(title('tt0000002', { artwork: `${url}?v=789&token=secret`, backdrop: '', images: [{ ...image, url }] }));
    expect(await readdir(join(directory, 'images'))).toEqual([`${key}.json`]);
    const record = await image_record();
    expect(record).toMatchObject({ key, url, title_ids: ['tt0000001', 'tt0000002'], credits: [{
      source: 'cinemeta', author: null, license: null, license_url: null, retrieved_at: null,
    }] });
    expect(record.credits).toHaveLength(1);
    expect(await read_json(join(directory, 'titles', 'tt0000002.json'))).toMatchObject({ artwork: url, images: [{ key, url }] });
    expect(await readFile(join(directory, 'titles', 'tt0000002.json'), 'utf8')).not.toContain('secret');
  });

  it('does not export authentication URL components or unknown credit fields', async () => {
    const image = { ...credit, source_url: 'https://user:password@images.example/image.jpg?token=secret#private',
      description_url: 'javascript:secret', headers: { Authorization: 'private-auth' }, provider_ids: { id: 'private-id' } };
    await create_attribution(directory).record(title('tt0000001', { images: [image] }));
    const text = await readFile(join(directory, 'images', `${key}.json`), 'utf8');
    expect((await image_record()).credits[0]).toMatchObject({ source_url: 'https://images.example/image.jpg', description_url: null });
    for (const forbidden of ['password', 'secret', 'private', 'headers', 'provider_ids']) expect(text).not.toContain(forbidden);
  });

  it('keeps manual evidence and rejects corrupt existing JSON without blocking later records', async () => {
    const archive = create_attribution(directory);
    await archive.record(title());
    const evidence = join(directory, 'manual', 'permission.txt');
    await writeFile(evidence, 'Original evidence');
    const path = join(directory, 'images', `${key}.json`);
    await writeFile(path, '{corrupt');
    await expect(archive.record(title('tt0000002'))).rejects.toThrow(SyntaxError);
    expect(await readFile(path, 'utf8')).toBe('{corrupt');
    await archive.record(title('tt0000003', { artwork: '', backdrop: '', images: [] }));
    expect(await readFile(evidence, 'utf8')).toBe('Original evidence');
    expect(await readdir(join(directory, 'titles'))).toEqual(['tt0000001.json', 'tt0000003.json']);
  });
});

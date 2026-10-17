import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Title } from '../../src/catalog/types.ts';
import type { LibrarySnapshot } from '../../src/library/types.ts';
import { SESSION_HEADER, type Profile, type ProfileSession } from '../../src/profiles/types.ts';
import { close_services, handle_api } from '../api.ts';
import { title } from '../storage/fixtures.ts';
import { create_store } from '../storage/index.ts';

const movie: Title = title('tt0133093');
let directory: string;
let server: Server;
let origin: string;
let admin: Profile;
let admin_token: string;

function send(method: string, path: string, value?: unknown, session?: string, headers: Record<string, string> = {}) {
  return fetch(`${origin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...session === undefined ? {} : { [SESSION_HEADER]: session }, ...headers },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}

async function body<T>(response: Response, status: number): Promise<T> {
  const value = await response.json() as T;
  expect(response.status, JSON.stringify(value)).toBe(status);
  return value;
}

async function sign_in(id: number, value: unknown = {}, session?: string): Promise<string> {
  return (await body<ProfileSession>(await send('POST', `/api/profiles/${id}/session`, value, session), 201)).token;
}

async function create(name: string): Promise<Profile> {
  return body<Profile>(await send('POST', '/api/profiles', { name }, admin_token), 201);
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-profile-routes-'));
  vi.stubEnv('STREAMIT_DATA_DIR', directory);
  vi.stubEnv('STREAMIT_SYNC', 'off');
  const store = create_store(directory);
  store.title_put([{ title: movie, genres: [] }]);
  admin = store.profile_create('test');
  store.close();
  server = createServer((req, res) => handle_api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  admin_token = await sign_in(admin.id);
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await close_services();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe('profiles API', () => {
  it('lists, creates, renames and deletes profiles with validation and same-origin checks', async () => {
    const dev = await create(' dev ');
    expect(dev).toEqual({ id: dev.id, name: 'dev', created_at: expect.any(String), is_admin: false, has_pin: false, avatar: { kind: 'eyes', seed: 0 } });
    expect((await body<Profile[]>(await send('GET', '/api/profiles'), 200)).map(item => item.name)).toEqual(['test', 'dev']);
    for (const [method, path, value, status] of [
      ['POST', '/api/profiles', { name: 'DEV' }, 400], ['POST', '/api/profiles', { name: '' }, 400],
      ['POST', '/api/profiles', { name: 'x'.repeat(25) }, 400], ['POST', '/api/profiles', { name: 'a', extra: 1 }, 400],
      ['PATCH', `/api/profiles/${dev.id}`, { name: 'Test' }, 400], ['PATCH', `/api/profiles/${dev.id}`, {}, 400],
      ['PATCH', `/api/profiles/${dev.id}`, { is_admin: 'yes' }, 400], ['PATCH', '/api/profiles/999', { name: 'other' }, 404],
      ['DELETE', `/api/profiles/${dev.id}`, {}, 400], ['DELETE', `/api/profiles/${dev.id}`, { confirm: 'test' }, 400],
      ['PATCH', `/api/profiles/${dev.id}/pin`, { pin: '12345' }, 400], ['PATCH', `/api/profiles/${dev.id}/pin`, { pin: 1234 }, 400],
      ['PATCH', `/api/profiles/${dev.id}/pin`, {}, 400],
    ] as const) {
      await body(await send(method, path, value, admin_token), status);
    }
    for (const [method, path, value] of [['POST', '/api/profiles', { name: 'evil' }], ['DELETE', `/api/profiles/${dev.id}`, { confirm: 'dev' }],
      ['POST', `/api/profiles/${dev.id}/session`, {}]] as const) {
      await body(await send(method, path, value, admin_token, { Origin: 'https://evil.example' }), 403);
    }
    expect(await body(await send('PATCH', `/api/profiles/${dev.id}`, { name: 'Dev 2' }, admin_token), 200)).toMatchObject({ id: dev.id, name: 'Dev 2' });
    expect((await body<Profile[]>(await send('DELETE', `/api/profiles/${dev.id}`, { confirm: 'Dev 2' }, admin_token), 200)).map(item => item.id)).toEqual([admin.id]);
    expect((await body<{ error: string }>(await send('DELETE', `/api/profiles/${admin.id}`, { confirm: 'test' }, admin_token), 400)).error).toContain('last profile');
  });

  it('needs a session for personal and profile requests, ignores bare profile ids and keeps profiles apart', async () => {
    for (const headers of [{}, { [SESSION_HEADER]: 'forged' }, { 'X-Watchit-Profile': String(admin.id) }] as Record<string, string>[]) {
      for (const path of ['/api/library', '/api/library/titles', '/api/library/continue', '/api/rankings', '/api/titles/tt0133093', '/api/catalog?hide=watched']) {
        expect((await body<{ error: string }>(await fetch(`${origin}${path}`, { headers }), 401)).error).toContain(SESSION_HEADER);
      }
      await body(await send('PATCH', '/api/library/tt0133093', { status: 'watched' }, undefined, headers), 401);
      await body(await send('POST', '/api/profiles', { name: 'sneaky' }, undefined, headers), 401);
      await body(await send('PATCH', `/api/profiles/${admin.id}/pin`, { pin: '1234' }, undefined, headers), 401);
    }
    await body(await send('GET', '/api/catalog'), 200);

    const other = await create('dev');
    const other_token = await sign_in(other.id);
    await body(await send('PATCH', '/api/library/tt0133093', { status: 'watched', rating: 4 }, admin_token), 200);
    await body(await send('PATCH', '/api/library/tt0133093/playback', { source: 'vidsrc' }, admin_token), 200);
    expect((await body<LibrarySnapshot>(await send('GET', '/api/library', undefined, other_token), 200)).entries).toEqual({});
    expect(await body(await send('GET', '/api/library/titles?status=watched', undefined, other_token), 200)).toMatchObject({ total: 0, items: [] });
    expect(await body(await send('GET', '/api/titles/tt0133093', undefined, other_token), 200)).toMatchObject({ playback_source: null });
    expect((await body<{ total: number }>(await send('GET', '/api/library/titles?status=watched', undefined, admin_token), 200)).total).toBe(1);
  });

  it('reports, ends and replaces the session of this device', async () => {
    expect(await body(await send('GET', '/api/session', undefined, admin_token), 200)).toEqual({ profile: admin });
    expect(await body(await send('GET', '/api/session', undefined, 'forged'), 200)).toEqual({ profile: null });
    const replacement = await sign_in(admin.id, {}, admin_token);
    await body(await send('GET', '/api/library', undefined, admin_token), 401);
    expect(await body(await send('DELETE', '/api/session', undefined, replacement), 200)).toEqual({ profile: null });
    await body(await send('GET', '/api/library', undefined, replacement), 401);
  });

  it('signs in to a PIN profile only with its PIN and locks out guessing with 429 and Retry-After', async () => {
    const kid = await create('kid');
    expect(await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '2468' }, admin_token), 200)).toEqual({ ...kid, has_pin: true });
    const listed = await (await send('GET', '/api/profiles')).text();
    expect(listed).not.toMatch(/salt|hash|2468/);
    expect(JSON.parse(listed)).toMatchObject([{ has_pin: false }, { has_pin: true }]);
    await body(await send('POST', `/api/profiles/${kid.id}/session`, {}), 403);
    await body(await send('POST', `/api/profiles/${kid.id}/session`, { pin: '24680' }), 400);
    await body(await send('GET', '/api/library', undefined, undefined, { 'X-Watchit-Profile': String(kid.id) }), 401);
    const kid_token = await sign_in(kid.id, { pin: '2468' });
    expect(await body(await send('GET', '/api/session', undefined, kid_token), 200)).toMatchObject({ profile: { id: kid.id } });
    expect(await (await send('POST', `/api/profiles/${kid.id}/session`, { pin: '2468' })).text()).not.toContain('2468');

    for (let attempt = 0; attempt < 4; attempt++) {
      expect((await body<{ error: string }>(await send('POST', `/api/profiles/${kid.id}/session`, { pin: '0000' }), 403)).error).toContain('Wrong PIN');
    }
    const locked = await send('POST', `/api/profiles/${kid.id}/session`, { pin: '0000' });
    expect(locked.headers.get('Retry-After')).toBe('30');
    expect((await body<{ error: string }>(locked, 429)).error).toContain('30 seconds');
    await body(await send('POST', `/api/profiles/${kid.id}/session`, { pin: '2468' }), 429);
    await sign_in(admin.id);
  });

  it('lets non-admins change only their own name and PIN, and admins manage everyone', async () => {
    const kid = await create('kid');
    const other = await create('other');
    const kid_token = await sign_in(kid.id);
    for (const [method, path, value] of [
      ['POST', '/api/profiles', { name: 'new' }], ['PATCH', `/api/profiles/${other.id}`, { name: 'renamed' }],
      ['PATCH', `/api/profiles/${kid.id}`, { is_admin: true }], ['PATCH', `/api/profiles/${other.id}/pin`, { pin: '1111' }],
      ['DELETE', `/api/profiles/${other.id}`, { confirm: 'other' }], ['DELETE', `/api/profiles/${kid.id}`, { confirm: 'kid' }],
    ] as const) {
      await body(await send(method, path, value, kid_token), 403);
    }
    expect(await body(await send('PATCH', `/api/profiles/${kid.id}`, { name: 'Kid' }, kid_token), 200)).toMatchObject({ name: 'Kid' });
    expect(await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '1111' }, kid_token), 200)).toMatchObject({ has_pin: true });
    await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '2222' }, kid_token), 403);
    await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '2222', current_pin: '9999' }, kid_token), 403);
    await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '2222', current_pin: '1111' }, kid_token), 200);
    expect(await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: null, current_pin: '2222' }, kid_token), 200)).toMatchObject({ has_pin: false });

    await body(await send('PATCH', `/api/profiles/${admin.id}`, { is_admin: false }, admin_token), 400);
    await body(await send('DELETE', `/api/profiles/${admin.id}`, { confirm: 'test' }, admin_token), 400);
    expect(await body(await send('PATCH', `/api/profiles/${other.id}/pin`, { pin: '3333' }, admin_token), 200)).toMatchObject({ has_pin: true });
    expect(await body(await send('PATCH', `/api/profiles/${other.id}/pin`, { pin: '4444' }, admin_token), 200)).toMatchObject({ has_pin: true });
    expect(await body(await send('PATCH', `/api/profiles/${other.id}/pin`, { pin: null }, admin_token), 200)).toMatchObject({ has_pin: false });
    expect(await body(await send('PATCH', `/api/profiles/${other.id}`, { name: 'Other' }, admin_token), 200)).toMatchObject({ name: 'Other' });
    expect(await body(await send('PATCH', `/api/profiles/${kid.id}`, { is_admin: true }, admin_token), 200)).toMatchObject({ is_admin: true });
    await body(await send('POST', '/api/profiles', { name: 'new' }, kid_token), 201);
    expect(await body(await send('PATCH', `/api/profiles/${admin.id}`, { is_admin: false }, kid_token), 200)).toMatchObject({ is_admin: false });
    await body(await send('PATCH', `/api/profiles/${kid.id}`, { is_admin: false }, kid_token), 400);
    await body(await send('POST', '/api/profiles', { name: 'newer' }, admin_token), 403);
    expect((await body<Profile[]>(await send('DELETE', `/api/profiles/${admin.id}`, { confirm: 'test' }, kid_token), 200)).map(item => item.name)).toEqual(['Kid', 'Other', 'new']);
    await body(await send('GET', '/api/library', undefined, admin_token), 401);
  });

  it('stores uploads as 256px WebP, serves them versioned and only lets the owner or an admin change them', async () => {
    const kid = await create('kid');
    const kid_token = await sign_in(kid.id);
    expect(kid.avatar).toEqual({ kind: 'eyes', seed: 0 });
    const photo = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#468' } }).jpeg().toBuffer();
    const upload = (id: number, token: string, image: Buffer<ArrayBuffer> = photo, type = 'image/jpeg') =>
      fetch(`${origin}/api/profiles/${id}/avatar`, { method: 'PUT', headers: { 'Content-Type': type, [SESSION_HEADER]: token }, body: image });

    await body(await upload(admin.id, kid_token), 403);
    await body(await send('POST', `/api/profiles/${admin.id}/avatar/shuffle`, undefined, kid_token), 403);
    await body(await upload(kid.id, kid_token, Buffer.from('not an image')), 400);
    await body(await upload(kid.id, kid_token, photo, 'text/plain'), 415);
    const updated = await body<Profile>(await upload(kid.id, kid_token), 200);
    if (updated.avatar.kind !== 'image') throw new Error('Expected an image avatar.');
    const served = await fetch(`${origin}${updated.avatar.url}`);
    expect(served.headers.get('cache-control')).toContain('immutable');
    expect(await sharp(Buffer.from(await served.arrayBuffer())).metadata()).toMatchObject({ format: 'webp', width: 256, height: 256 });

    await body(await upload(kid.id, admin_token), 200);
    expect(await body(await send('DELETE', `/api/profiles/${kid.id}/avatar`, undefined, kid_token), 200)).toMatchObject({ avatar: { kind: 'eyes' } });
    expect((await body<Profile>(await send('POST', `/api/profiles/${kid.id}/avatar/shuffle`, undefined, kid_token), 200)).avatar).not.toEqual(kid.avatar);
  });

  it('revokes the other sessions of a profile when its PIN changes', async () => {
    const kid = await create('kid');
    const phone = await sign_in(kid.id);
    const tablet = await sign_in(kid.id);
    await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '1357' }, phone), 200);
    await body(await send('GET', '/api/library', undefined, tablet), 401);
    await body(await send('GET', '/api/library', undefined, phone), 200);
    await body(await send('PATCH', `/api/profiles/${kid.id}/pin`, { pin: '2468' }, admin_token), 200);
    await body(await send('GET', '/api/library', undefined, phone), 401);
    await body(await send('GET', '/api/library', undefined, admin_token), 200);
    await sign_in(kid.id, { pin: '2468' });
  });

  it('lets anyone create the first profile, which becomes the admin', async () => {
    const store_directory = await mkdtemp(join(tmpdir(), 'streamit-profile-first-'));
    await close_services();
    vi.stubEnv('STREAMIT_DATA_DIR', store_directory);
    expect(await body(await send('POST', '/api/profiles', { name: 'owner' }), 201)).toMatchObject({ name: 'owner', is_admin: true });
    await body(await send('POST', '/api/profiles', { name: 'guest' }), 401);
    await close_services();
    await rm(store_directory, { recursive: true, force: true });
  });
});

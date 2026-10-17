import type { IncomingMessage, ServerResponse } from 'node:http';
import { PIN_LENGTH, SESSION_HEADER, type PinChange, type Profile, type ProfilePatch } from '../../src/profiles/types.ts';
import { HttpError, json, read_json } from '../http.ts';
import { read_avatar, send_avatar } from './avatar.ts';
import { validate_pin } from '../storage/validation.ts';
import type { Store } from '../storage/types.ts';

function session_token(req: IncomingMessage): string | null {
  const value = req.headers[SESSION_HEADER.toLowerCase()];
  return typeof value === 'string' && value ? value : null;
}

export function session_profile(req: IncomingMessage, store: Store): Profile | null {
  const token = session_token(req);
  const id = token === null ? null : store.session_profile(token);
  return id === null ? null : store.profile_get(id);
}

export function signed_in(req: IncomingMessage, store: Store): Profile {
  const profile = session_profile(req, store);
  if (!profile) throw new HttpError(401, `Sign in first: POST /api/profiles/:id/session, then send its token in the ${SESSION_HEADER} header.`);
  return profile;
}

function require_admin(viewer: Profile): void {
  if (!viewer.is_admin) throw new HttpError(403, 'Only an admin can do that.');
}

function require_self_or_admin(viewer: Profile, target: Profile): void {
  if (viewer.id !== target.id && !viewer.is_admin) throw new HttpError(403, 'You can only change your own profile.');
}

function profile_target(segment: string, store: Store): Profile {
  const profile = /^[1-9]\d{0,14}$/.test(segment) ? store.profile_get(Number(segment)) : null;
  if (!profile) throw new HttpError(404, 'Profile not found.');
  return profile;
}

function editable_target(req: IncomingMessage, segment: string, store: Store): Profile {
  const viewer = signed_in(req, store);
  const profile = profile_target(segment, store);
  require_self_or_admin(viewer, profile);
  return profile;
}

function client_address(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function text_field(body: Record<string, unknown>, field: string): string {
  if (typeof body[field] !== 'string' || Object.keys(body).length !== 1) throw new HttpError(400, `Body must contain only a ${field} string.`);
  return body[field];
}

function pin_field(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, `A PIN is exactly ${PIN_LENGTH} digits.`);
  validate_pin(value);
  return value;
}

function session_pin(body: Record<string, unknown>): string | undefined {
  if (Object.keys(body).some(key => key !== 'pin')) throw new HttpError(400, 'Body may contain only a pin.');
  return body.pin === undefined ? undefined : pin_field(body.pin);
}

function pin_change(body: Record<string, unknown>): PinChange {
  if (!Object.hasOwn(body, 'pin') || Object.keys(body).some(key => key !== 'pin' && key !== 'current_pin')) {
    throw new HttpError(400, 'Body must contain pin (digits, or null to remove it) and optionally current_pin.');
  }
  return {
    pin: body.pin === null ? null : pin_field(body.pin),
    current_pin: body.current_pin === undefined ? undefined : pin_field(body.current_pin),
  };
}

function profile_patch(body: Record<string, unknown>): ProfilePatch {
  const patch: ProfilePatch = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'name' && typeof value === 'string') patch.name = value;
    else if (key === 'is_admin' && typeof value === 'boolean') patch.is_admin = value;
    else throw new HttpError(400, 'Body may contain only a name string and an is_admin boolean.');
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'Body may contain only a name string and an is_admin boolean.');
  return patch;
}

export async function profile_route(req: IncomingMessage, res: ServerResponse, url: URL, store: Store) {
  const session_match = /^\/api\/profiles\/([^/]+)\/session$/.exec(url.pathname);
  const pin_match = /^\/api\/profiles\/([^/]+)\/pin$/.exec(url.pathname);
  const profile_match = /^\/api\/profiles\/([^/]+)$/.exec(url.pathname);
  const avatar_match = /^\/api\/profiles\/([^/]+)\/avatar$/.exec(url.pathname);
  const shuffle_match = /^\/api\/profiles\/([^/]+)\/avatar\/shuffle$/.exec(url.pathname);

  if (url.pathname === '/api/session' && req.method === 'GET') return json(res, { profile: session_profile(req, store) });
  if (url.pathname === '/api/session' && req.method === 'DELETE') {
    const token = session_token(req);
    if (token !== null) store.session_delete(token);
    return json(res, { profile: null });
  }
  if (url.pathname === '/api/profiles' && req.method === 'GET') return json(res, store.profile_list());
  if (url.pathname === '/api/profiles' && req.method === 'POST') {
    if (store.profile_list().length) require_admin(signed_in(req, store));
    return json(res, store.profile_create(text_field(await read_json(req), 'name')), 201);
  }
  if (session_match?.[1] && req.method === 'POST') {
    const profile = profile_target(session_match[1], store);
    store.pin_check(profile.id, session_pin(await read_json(req)), client_address(req));
    const previous = session_token(req);
    if (previous !== null) store.session_delete(previous);
    return json(res, { token: store.session_create(profile.id), profile }, 201);
  }
  if (pin_match?.[1] && req.method === 'PATCH') {
    const viewer = signed_in(req, store);
    const profile = profile_target(pin_match[1], store);
    const change = pin_change(await read_json(req));
    const own = viewer.id === profile.id;
    if (own) store.pin_check(profile.id, change.current_pin, client_address(req));
    else require_admin(viewer);
    store.pin_set(profile.id, change.pin);
    store.sessions_revoke(profile.id, own ? session_token(req) : null);
    return json(res, store.profile_get(profile.id));
  }
  if (avatar_match?.[1] && req.method === 'GET') return send_avatar(req, res, url, store.avatar_get(profile_target(avatar_match[1], store).id));
  if (avatar_match?.[1] && req.method === 'PUT') {
    const profile = editable_target(req, avatar_match[1], store);
    store.avatar_put(profile.id, await read_avatar(req));
    return json(res, store.profile_get(profile.id));
  }
  if (avatar_match?.[1] && req.method === 'DELETE') {
    const profile = editable_target(req, avatar_match[1], store);
    store.avatar_delete(profile.id);
    return json(res, store.profile_get(profile.id));
  }
  if (shuffle_match?.[1] && req.method === 'POST') {
    const profile = editable_target(req, shuffle_match[1], store);
    store.avatar_shuffle(profile.id);
    return json(res, store.profile_get(profile.id));
  }
  if (profile_match?.[1] && req.method === 'PATCH') {
    const viewer = signed_in(req, store);
    const profile = profile_target(profile_match[1], store);
    const patch = profile_patch(await read_json(req));
    if (patch.is_admin === undefined) require_self_or_admin(viewer, profile);
    else require_admin(viewer);
    return json(res, store.profile_update(profile.id, patch));
  }
  if (profile_match?.[1] && req.method === 'DELETE') {
    require_admin(signed_in(req, store));
    const profile = profile_target(profile_match[1], store);
    return json(res, store.profile_delete(profile.id, text_field(await read_json(req), 'confirm')));
  }
  throw new HttpError(404, 'API route not found.');
}

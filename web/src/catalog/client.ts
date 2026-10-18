import { remember, responses } from '../cache/responses';
import { active_session, end_session } from '../profiles/session';
import { SESSION_HEADER } from '../profiles/types';
import type { ApiError } from './types';

type Pending = { operation: Promise<unknown>; controller: AbortController; users: number };

const pending = new Map<string, Pending>();

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly retry_after?: number) { super(message); }
}

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (active_session) headers.set(SESSION_HEADER, active_session.token);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && active_session) end_session();
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiError | null;
    const retry_after = response.headers.get('Retry-After');
    throw new HttpError(response.status, body?.error || `Request failed (${response.status}).`, retry_after === null ? undefined : Number(retry_after));
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function send<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown, options?: RequestInit): Promise<T> {
  const headers = body === undefined ? undefined : { 'Content-Type': 'application/json' };
  return request<T>(url, { ...options, method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function start<T extends object>(url: string): Pending {
  const controller = new AbortController();
  const previous = responses.get(url);
  const entry: Pending = { operation: Promise.resolve(), controller, users: 0 };
  entry.operation = request<T>(url, { signal: controller.signal }).then(data => {
    if (responses.get(url) !== previous) return data;
    if (JSON.stringify(previous) === JSON.stringify(data)) return previous as T;
    remember(url, data);
    return data;
  }).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404 && responses.get(url) === previous) responses.delete(url);
    throw error;
  }).finally(() => {
    if (pending.get(url) === entry) pending.delete(url);
  });
  pending.set(url, entry);
  return entry;
}

export function read<T extends object>(url: string, signal?: AbortSignal): Promise<T> {
  const entry = pending.get(url) ?? start<T>(url);
  entry.users++;
  signal?.addEventListener('abort', () => {
    if (--entry.users > 0) return;
    entry.controller.abort();
    if (pending.get(url) === entry) pending.delete(url);
  }, { once: true });
  return entry.operation as Promise<T>;
}

export function error_message(cause: unknown, fallback = 'The server did not respond.') {
  return cause instanceof Error ? cause.message : fallback;
}

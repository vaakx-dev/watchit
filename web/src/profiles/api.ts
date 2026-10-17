import { request } from '../catalog/client';
import type { PinChange, Profile, ProfilePatch, ProfileSession, SessionState } from './types';

function send<T>(url: string, method: string, body: unknown): Promise<T> {
  return request<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export function sign_in(id: number, pin?: string): Promise<ProfileSession> {
  return send(`/api/profiles/${id}/session`, 'POST', pin === undefined ? {} : { pin });
}

export function sign_out(): Promise<SessionState> {
  return request('/api/session', { method: 'DELETE' });
}

export function create_profile(name: string): Promise<Profile> {
  return send('/api/profiles', 'POST', { name });
}

export function update_profile(id: number, patch: ProfilePatch): Promise<Profile> {
  return send(`/api/profiles/${id}`, 'PATCH', patch);
}

export function change_pin(id: number, change: PinChange): Promise<Profile> {
  return send(`/api/profiles/${id}/pin`, 'PATCH', change);
}

export function delete_profile(id: number, confirm: string): Promise<Profile[]> {
  return send(`/api/profiles/${id}`, 'DELETE', { confirm });
}

export function upload_avatar(id: number, image: File): Promise<Profile> {
  return request(`/api/profiles/${id}/avatar`, { method: 'PUT', headers: { 'Content-Type': image.type }, body: image });
}

export function remove_avatar(id: number): Promise<Profile> {
  return request(`/api/profiles/${id}/avatar`, { method: 'DELETE' });
}

export function shuffle_avatar(id: number): Promise<Profile> {
  return request(`/api/profiles/${id}/avatar/shuffle`, { method: 'POST' });
}

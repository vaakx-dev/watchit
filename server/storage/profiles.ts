import type { DatabaseSync } from 'node:sqlite';
import type { Avatar, Profile, ProfilePatch } from '../../src/profiles/types.ts';
import { validate_profile_name } from './validation.ts';

type ProfileRow = Omit<Profile, 'is_admin' | 'has_pin' | 'avatar'> & { is_admin: number; has_pin: number; avatar_seed: number; avatar_version: number | null };

const COLUMNS = `id, name, created_at, is_admin, avatar_seed,
  EXISTS (SELECT 1 FROM profile_pins WHERE profile_id = profiles.id) AS has_pin,
  (SELECT updated_at FROM profile_avatars WHERE profile_id = profiles.id) AS avatar_version`;

function avatar(id: number, seed: number, version: number | null): Avatar {
  if (version === null) return { kind: 'eyes', seed };
  return { kind: 'image', url: `/api/profiles/${id}/avatar?v=${version}` };
}

function profile_from_row({ avatar_seed, avatar_version, ...row }: ProfileRow): Profile {
  return { ...row, is_admin: Boolean(row.is_admin), has_pin: Boolean(row.has_pin), avatar: avatar(row.id, avatar_seed, avatar_version) };
}

export function create_profiles(database: DatabaseSync, transaction: <T>(operation: () => T) => T) {
  const queries = {
    list: database.prepare(`SELECT ${COLUMNS} FROM profiles ORDER BY id`),
    get: database.prepare(`SELECT ${COLUMNS} FROM profiles WHERE id = ?`),
    insert: database.prepare('INSERT INTO profiles (name, created_at, is_admin) VALUES (?, ?, ?) RETURNING id'),
    rename: database.prepare('UPDATE profiles SET name = ? WHERE id = ?'),
    admin: database.prepare('UPDATE profiles SET is_admin = ? WHERE id = ?'),
    delete: database.prepare('DELETE FROM profiles WHERE id = ?'),
    forget_attempts: database.prepare('DELETE FROM pin_attempts WHERE scope = ?'),
  };

  function profile_list(): Profile[] {
    return (queries.list.all() as ProfileRow[]).map(profile_from_row);
  }

  function profile_get(id: number): Profile | null {
    const row = queries.get.get(id) as ProfileRow | undefined;
    return row ? profile_from_row(row) : null;
  }

  function available_name(name: string, except?: number): string {
    const trimmed = name.trim();
    validate_profile_name(trimmed);
    const taken = profile_list().find(profile => profile.id !== except && profile.name.toLowerCase() === trimmed.toLowerCase());
    if (taken) throw new RangeError(`A profile named "${taken.name}" already exists.`);
    return trimmed;
  }

  function existing(id: number): Profile {
    const profile = profile_get(id);
    if (!profile) throw new RangeError('Profile not found.');
    return profile;
  }

  function only_admin(profile: Profile): boolean {
    return profile.is_admin && profile_list().filter(other => other.is_admin).length === 1;
  }

  return {
    profile_list,
    profile_get,
    profile_create(name: string): Profile {
      return transaction(() => {
        const first = profile_list().length === 0;
        const { id } = queries.insert.get(available_name(name), new Date().toISOString(), Number(first)) as { id: number };
        return existing(id);
      });
    },
    profile_update(id: number, patch: ProfilePatch): Profile {
      return transaction(() => {
        const profile = existing(id);
        if (patch.name !== undefined) queries.rename.run(available_name(patch.name, id), id);
        if (patch.is_admin === false && only_admin(profile)) throw new RangeError('Make another profile an admin first. There must always be one.');
        if (patch.is_admin !== undefined) queries.admin.run(Number(patch.is_admin), id);
        return existing(id);
      });
    },
    profile_delete(id: number, confirm: string): Profile[] {
      return transaction(() => {
        const profile = existing(id);
        if (confirm !== profile.name) throw new RangeError(`Confirm by sending the profile name "${profile.name}".`);
        if (profile_list().length === 1) throw new RangeError('The last profile cannot be deleted.');
        if (only_admin(profile)) throw new RangeError('The only admin cannot be deleted. Make another profile an admin first.');
        queries.delete.run(id);
        queries.forget_attempts.run(`profile:${id}`);
        return profile_list();
      });
    },
  };
}

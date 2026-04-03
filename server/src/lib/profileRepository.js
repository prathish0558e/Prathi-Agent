import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger.js';

const storagePath = path.resolve(process.cwd(), 'storage', 'profile-sync.json');
const logger = new Logger('profile-repository');
let writeQueue = Promise.resolve();

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const ensureStorageFile = async () => {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({}, null, 2), 'utf8');
  }
};

const readStorage = async () => {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const writeStorage = async (payload) => {
  writeQueue = writeQueue.then(() => fs.writeFile(storagePath, JSON.stringify(payload, null, 2), 'utf8'));
  await writeQueue;
};

export class ProfileRepository {
  constructor({ supabaseUrl, supabaseServiceRoleKey, tableName = 'career_profiles_sync' } = {}) {
    const resolvedUrl = supabaseUrl || process.env.SUPABASE_URL || '';
    const resolvedKey = supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.tableName = process.env.SUPABASE_PROFILE_TABLE || tableName;
    this.enabled = Boolean(resolvedUrl && resolvedKey);
    this.client = this.enabled ? createClient(resolvedUrl, resolvedKey) : null;
  }

  async getProfileByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return null;
    }

    if (this.enabled && this.client) {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('email, profile, updated_at')
        .eq('email', normalized)
        .maybeSingle();

      if (error) {
        logger.error('Supabase profile fetch failed', { message: error.message });
        throw new Error(error.message);
      }

      if (!data) {
        return null;
      }

      return {
        profile: data.profile || null,
        updatedAt: data.updated_at || null,
      };
    }

    const payload = await readStorage();
    return payload[normalized] || null;
  }

  async upsertProfile(profile) {
    const normalized = normalizeEmail(profile?.email);
    if (!normalized) {
      throw new Error('Email is required to store profile.');
    }

    const entry = {
      profile: { ...profile, email: normalized },
      updatedAt: new Date().toISOString(),
    };

    if (this.enabled && this.client) {
      const { error } = await this.client.from(this.tableName).upsert({
        email: normalized,
        profile: entry.profile,
        updated_at: entry.updatedAt,
      });

      if (error) {
        logger.error('Supabase profile upsert failed', { message: error.message });
        throw new Error(error.message);
      }

      return entry;
    }

    const payload = await readStorage();
    payload[normalized] = entry;
    await writeStorage(payload);
    return entry;
  }
}

export const profileRepository = new ProfileRepository();

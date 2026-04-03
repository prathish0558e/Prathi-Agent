import type { CareerProfile } from '../types/profile';
import { runtimeConfig } from './runtimeConfig';

const profileUrl = (path: string) => `${runtimeConfig.apiBaseUrl}/profile${path}`;

export const fetchRemoteProfile = async (email: string): Promise<CareerProfile | null> => {
  if (!email) {
    return null;
  }

  try {
    const response = await fetch(`${profileUrl('/sync')}?${new URLSearchParams({ email }).toString()}`);
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as { profile?: CareerProfile };
    return payload.profile ?? null;
  } catch {
    return null;
  }
};

export const saveRemoteProfile = async (profile: CareerProfile): Promise<boolean> => {
  if (!profile?.email) {
    return false;
  }

  try {
    const response = await fetch(profileUrl('/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });

    return response.ok;
  } catch {
    return false;
  }
};

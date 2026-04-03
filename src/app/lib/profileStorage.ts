import { emptyCareerProfile, type CareerProfile } from '../types/profile';

const profileStorageKey = (email: string) => `career_agent_profile:${email.toLowerCase()}`;

export function hasStoredCareerProfile(email: string): boolean {
  return Boolean(localStorage.getItem(profileStorageKey(email)));
}

export function loadCareerProfile(email: string): CareerProfile {
  const stored = localStorage.getItem(profileStorageKey(email));
  if (!stored) {
    return { ...emptyCareerProfile, email };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<CareerProfile>;
    return {
      ...emptyCareerProfile,
      ...parsed,
      email,
    };
  } catch {
    return { ...emptyCareerProfile, email };
  }
}

export function saveCareerProfile(profile: CareerProfile) {
  localStorage.setItem(profileStorageKey(profile.email), JSON.stringify(profile));
}
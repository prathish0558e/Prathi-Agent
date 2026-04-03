import { Router } from 'express';
import { z } from 'zod';
import { profileRepository } from '../lib/profileRepository.js';

export const profileRouter = Router();

const onboardingSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phoneCountryCode: z.string().min(1),
  phone: z.string().min(7),
  experienceLevel: z.enum(['Fresher', 'Intern', 'Junior', 'Mid-Level']),
  targetRoles: z.array(z.string()).min(1),
  primarySkills: z.array(z.string()).min(1),
  preferredLocations: z.array(z.string()),
  wantsAutoApply: z.boolean(),
  wantsMailAutomation: z.boolean(),
  resumeFileName: z.string(),
  resumeLastUpdated: z.string().nullable(),
});

const syncSchema = z.object({
  email: z.string().email(),
}).passthrough();

profileRouter.get('/me', (_request, response) => {
  response.status(501).json({
    message: 'Connect PostgreSQL or Supabase to return the authenticated profile.',
  });
});

profileRouter.post('/onboarding', (request, response) => {
  const result = onboardingSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({ message: 'Invalid onboarding payload', issues: result.error.flatten() });
    return;
  }

  response.status(202).json({
    message: 'Validated. Persist this payload using parameterized queries and encrypted fields.',
    profile: result.data,
  });
});

profileRouter.get('/sync', async (request, response, next) => {
  try {
    const email = String(request.query.email || '').trim();
    if (!email) {
      response.status(400).json({ message: 'email query is required.' });
      return;
    }

    const stored = await profileRepository.getProfileByEmail(email);
    if (!stored || !stored.profile) {
      response.status(404).json({ message: 'Profile not found.' });
      return;
    }

    response.json({ profile: stored.profile, updatedAt: stored.updatedAt || null });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/sync', async (request, response, next) => {
  try {
    const payload = syncSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: 'Invalid profile payload.', issues: payload.error.flatten() });
      return;
    }

    const stored = await profileRepository.upsertProfile(payload.data);
    response.status(200).json({ profile: stored.profile, updatedAt: stored.updatedAt });
  } catch (error) {
    next(error);
  }
});

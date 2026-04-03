import { Router } from 'express';
import { z } from 'zod';

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

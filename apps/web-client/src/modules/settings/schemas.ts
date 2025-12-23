/**
 * Validation schemas for settings forms.
 */

import { z } from 'zod';
import type { getDictionary } from '@/shared/i18n';

type Dict = ReturnType<typeof getDictionary>;

/** Creates profile form schema with i18n messages. */
export function createProfileSchema(dict: Dict) {
  return z.object({
    username: z
      .string()
      .min(3, dict.settings.validation.usernameMin)
      .max(20, dict.settings.validation.usernameMax)
      .regex(/^[a-zA-Z0-9_]+$/, dict.settings.validation.usernameFormat),
    bio: z
      .string()
      .max(500, dict.settings.validation.bioMax)
      .optional(),
    location: z
      .string()
      .max(100, dict.settings.validation.locationMax)
      .optional(),
    website: z
      .string()
      .url(dict.settings.validation.websiteInvalid)
      .optional()
      .or(z.literal('')),
    preferredLanguage: z.enum(['uk', 'en']).optional(),
    preferredRegion: z.string().optional(),
  });
}

/** Creates password change form schema with i18n messages. */
export function createPasswordSchema(dict: Dict) {
  return z
    .object({
      currentPassword: z.string().min(1, dict.settings.validation.currentPasswordRequired),
      newPassword: z.string().min(8, dict.settings.validation.passwordMin),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: dict.settings.validation.passwordMismatch,
      path: ['confirmPassword'],
    });
}

export type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;
export type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

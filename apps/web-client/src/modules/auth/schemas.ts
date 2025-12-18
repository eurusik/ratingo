/**
 * Validation schemas for auth forms.
 */

import { z } from 'zod';
import type { getDictionary } from '@/shared/i18n';

type Dict = ReturnType<typeof getDictionary>;

/** Creates login form schema with i18n messages. */
export function createLoginSchema(dict: Dict) {
  return z.object({
    email: z.string().email(dict.auth.validation.emailInvalid),
    password: z.string().min(6, dict.auth.validation.passwordMin),
  });
}

/** Creates register form schema with i18n messages. */
export function createRegisterSchema(dict: Dict) {
  return z.object({
    email: z.string().email(dict.auth.validation.emailInvalid),
    username: z
      .string()
      .min(3, dict.auth.validation.usernameMin)
      .max(20, dict.auth.validation.usernameMax)
      .regex(/^[a-zA-Z0-9_]+$/, dict.auth.validation.usernameFormat),
    password: z.string().min(6, dict.auth.validation.passwordMin),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: dict.auth.validation.passwordMismatch,
    path: ['confirmPassword'],
  });
}

export type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;
export type RegisterFormData = z.infer<ReturnType<typeof createRegisterSchema>>;

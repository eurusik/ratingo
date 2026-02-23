/**
 * Validation schemas for auth forms.
 */

import { z } from 'zod';
import type { getDictionary } from '@/shared/i18n';

type Dict = ReturnType<typeof getDictionary>;

/** Must match backend PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/ */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** Creates login form schema with i18n messages. */
export function createLoginSchema(dict: Dict) {
  return z.object({
    email: z.string().email(dict.auth.validation.emailInvalid),
    password: z.string().min(1, dict.auth.validation.passwordRequired),
  });
}

/** Creates register form schema with i18n messages. */
export function createRegisterSchema(dict: Dict) {
  return z
    .object({
      email: z.string().email(dict.auth.validation.emailInvalid),
      username: z
        .string()
        .min(3, dict.auth.validation.usernameMin)
        .max(20, dict.auth.validation.usernameMax)
        .regex(/^[a-zA-Z0-9_]+$/, dict.auth.validation.usernameFormat),
      password: z
        .string()
        .min(8, dict.auth.validation.passwordMin)
        .regex(PASSWORD_REGEX, dict.auth.validation.passwordFormat),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: dict.auth.validation.passwordMismatch,
      path: ['confirmPassword'],
    });
}

export type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;
export type RegisterFormData = z.infer<ReturnType<typeof createRegisterSchema>>;

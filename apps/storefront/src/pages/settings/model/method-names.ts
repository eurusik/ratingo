'use client';

import { useTranslation } from '@/shared/i18n';
import { capitalizeFirst } from '@/shared/lib';
import { useAccount } from './account';
import { activeMethods, type SignInMethod } from './sign-in-methods';

export function useMethodNames(): (methods: readonly SignInMethod[]) => string {
  const { dict } = useTranslation();
  return (methods) =>
    methods.map((method) => dict.settings.security.methodNames[method]).join(', ');
}

export function useSignInSummary(): string {
  const user = useAccount();
  return capitalizeFirst(useMethodNames()(activeMethods(user)));
}

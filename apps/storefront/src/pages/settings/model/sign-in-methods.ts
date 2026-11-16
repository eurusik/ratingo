import { OAUTH_PROVIDERS, type OAuthProvider } from '@/shared/auth';

export type SignInMethod = OAuthProvider | 'email';

export interface AccountMethods {
  linkedProviders: readonly string[];
  hasPassword: boolean;
}

function isLinked(account: AccountMethods, provider: OAuthProvider): boolean {
  return account.linkedProviders.includes(provider);
}

export function activeMethods(account: AccountMethods): SignInMethod[] {
  const providers: SignInMethod[] = OAUTH_PROVIDERS.filter((provider) =>
    isLinked(account, provider),
  );
  return account.hasPassword ? [...providers, 'email'] : providers;
}

export function canUnlink(account: AccountMethods): boolean {
  return activeMethods(account).length > 1;
}

export function methodsLeftAfterUnlink(
  account: AccountMethods,
  provider: OAuthProvider,
): SignInMethod[] {
  return activeMethods(account).filter((method) => method !== provider);
}

export function listedProviders(
  account: AccountMethods,
  enabled: readonly OAuthProvider[],
): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter(
    (provider) => enabled.includes(provider) || isLinked(account, provider),
  );
}

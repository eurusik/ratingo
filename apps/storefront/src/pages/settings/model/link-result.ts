import { OAUTH_PROVIDERS, type OAuthProvider } from '@/shared/auth';

export type LinkOutcome = 'linked' | 'alreadyLinked' | 'failed';

export interface LinkResult {
  provider: OAuthProvider;
  outcome: LinkOutcome;
}

const ALREADY_LINKED_ERROR = 'ALREADY_LINKED';

function providerOf(value: string | null): OAuthProvider | null {
  return OAUTH_PROVIDERS.find((provider) => provider === value) ?? null;
}

export function linkResultOf(search: string): LinkResult | null {
  const params = new URLSearchParams(search);
  const linked = providerOf(params.get('linked'));
  if (linked) return { provider: linked, outcome: 'linked' };

  const error = params.get('linkError');
  const provider = providerOf(params.get('provider'));
  if (!error || !provider) return null;
  return { provider, outcome: error === ALREADY_LINKED_ERROR ? 'alreadyLinked' : 'failed' };
}

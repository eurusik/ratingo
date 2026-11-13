'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { OAUTH_PROVIDERS, buildOAuthStartUrl } from '@/shared/auth';
import { API_BASE_URL } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useBrowserOrigin } from '@/shared/lib';

const HOME_PATH = '/';

function OAuthSignInLinks({ origin }: { origin: string }) {
  const { dict } = useTranslation();

  return (
    <div className="actions">
      {OAUTH_PROVIDERS.map((provider) => (
        <a
          key={provider}
          className="action"
          href={buildOAuthStartUrl({
            apiBaseUrl: API_BASE_URL,
            provider,
            returnTo: HOME_PATH,
            returnOrigin: origin,
          })}
        >
          {dict.session.signInWith[provider]}
        </a>
      ))}
    </div>
  );
}

function SessionCard({ children }: { children: ReactNode }) {
  const { dict } = useTranslation();

  return (
    <section className="card" aria-labelledby="session-heading">
      <h2 id="session-heading">{dict.session.heading}</h2>
      {children}
    </section>
  );
}

export function SessionStatus() {
  const { dict } = useTranslation();
  const { user, isLoading, logout } = useAuth();
  const origin = useBrowserOrigin();

  if (isLoading) {
    return (
      <SessionCard>
        <p className="muted" role="status">
          {dict.session.loading}
        </p>
      </SessionCard>
    );
  }

  if (user) {
    return (
      <SessionCard>
        <p role="status">
          {dict.session.signedInAs} <strong translate="no">{user.username}</strong>
        </p>
        <div className="actions">
          <button type="button" className="action" onClick={() => void logout()}>
            {dict.session.signOut}
          </button>
        </div>
      </SessionCard>
    );
  }

  return (
    <SessionCard>
      <p className="muted" role="status">
        {dict.session.guest}
      </p>
      {origin ? <OAuthSignInLinks origin={origin} /> : null}
    </SessionCard>
  );
}

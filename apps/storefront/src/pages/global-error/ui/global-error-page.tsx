'use client';

import { useSyncExternalStore } from 'react';
import { BRAND_NAME } from '@/shared/config';
import { GLOBAL_ERROR_COPY, globalErrorLocale } from '../model/global-error-copy';
import { GLOBAL_ERROR_STYLES as STYLES } from './global-error-styles';

const subscribeToNothing = () => () => undefined;
const readBrowserLocale = () => globalErrorLocale(document.cookie, navigator.language);
const readServerLocale = () => globalErrorLocale('');

interface GlobalErrorPageProps {
  digest?: string;
}

export function GlobalErrorPage({ digest }: GlobalErrorPageProps) {
  const locale = useSyncExternalStore(subscribeToNothing, readBrowserLocale, readServerLocale);
  const copy = GLOBAL_ERROR_COPY[locale];

  return (
    <html lang={locale} style={{ colorScheme: 'dark' }}>
      <body style={STYLES.body}>
        <title>{copy.title}</title>
        <header translate="no" style={STYLES.header}>
          <span aria-hidden style={STYLES.logoTile}>
            R
            <span style={STYLES.logoDot} />
          </span>
          {BRAND_NAME}
        </header>
        <main style={STYLES.main}>
          <div role="alert">
            <h1 style={STYLES.title}>{copy.title}</h1>
            <p style={STYLES.text}>{copy.text}</p>
          </div>
          <button type="button" style={STYLES.button} onClick={() => window.location.reload()}>
            {copy.reload}
          </button>
          {digest ? <p style={STYLES.code}>{`${copy.errorCode} ${digest}`}</p> : null}
        </main>
      </body>
    </html>
  );
}

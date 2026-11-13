import Link from 'next/link';
import { getDictionary, type Locale } from '@/shared/i18n';
import { SessionStatus } from './session-status';

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <main className="page">
      <h1 translate="no">{dict.home.title}</h1>
      <p className="muted">{dict.home.subtitle}</p>
      <SessionStatus />
      <Link href="/spike" className="action self-start">
        {dict.home.uiSpikeLink}
      </Link>
    </main>
  );
}

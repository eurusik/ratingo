import { getDictionary, type Locale } from '@/shared/i18n';
import { SessionStatus } from './session-status';

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <div className="page">
      <h1 translate="no">{dict.home.title}</h1>
      <p className="muted">{dict.home.subtitle}</p>
      <SessionStatus />
    </div>
  );
}

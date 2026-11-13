import { getDictionary, type Locale } from '@/shared/i18n';
import { SessionStatus } from './session-status';
import { TrendingToday } from './trending-today';

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <>
      <TrendingToday />
      <div className="page">
        <h1 translate="no">{dict.home.title}</h1>
        <p className="muted">{dict.home.subtitle}</p>
        <SessionStatus />
      </div>
    </>
  );
}

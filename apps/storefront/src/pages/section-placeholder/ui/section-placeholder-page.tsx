import type { NavSection } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';

interface SectionPlaceholderPageProps {
  locale: Locale;
  section: NavSection;
}

export function SectionPlaceholderPage({ locale, section }: SectionPlaceholderPageProps) {
  const dict = getDictionary(locale);

  return (
    <div className="page">
      <h1 className="text-2xl font-bold">{dict.nav[section]}</h1>
      <p className="muted">{dict.placeholder.comingSoon}</p>
    </div>
  );
}

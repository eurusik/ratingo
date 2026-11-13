import { HomePage } from '@/pages/home';
import { DEFAULT_LOCALE } from '@/shared/i18n';

export default function HomeRoute() {
  return <HomePage locale={DEFAULT_LOCALE} />;
}

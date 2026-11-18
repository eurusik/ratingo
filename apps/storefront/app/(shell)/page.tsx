import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { HomePage, homeMetadata } from '@/pages/home';
import { TranslationScope } from '@/shared/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getRequestLocale());
}

export default async function HomeRoute() {
  const locale = await getRequestLocale();

  return (
    <TranslationScope locale={locale} namespaces={['home', 'library', 'rail']}>
      <HomePage locale={locale} />
    </TranslationScope>
  );
}

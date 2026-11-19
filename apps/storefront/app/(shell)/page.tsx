import type { Metadata } from 'next';
import { RouteTranslationScope, getRequestLocale } from '@/app/entrypoint';
import { HomePage, homeMetadata } from '@/pages/home';

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getRequestLocale());
}

export default async function HomeRoute() {
  return (
    <RouteTranslationScope namespaces={['home', 'library', 'rail', 'release']}>
      <HomePage locale={await getRequestLocale()} />
    </RouteTranslationScope>
  );
}

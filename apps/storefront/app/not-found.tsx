import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { ShellLayout } from '@/app/layouts';
import { NotFoundPage } from '@/pages/not-found';
import { getDictionary } from '@/shared/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getRequestLocale());

  return { title: dict.notFound.metaTitle, robots: { index: false, follow: true } };
}

export default async function NotFound() {
  const locale = await getRequestLocale();

  return (
    <ShellLayout locale={locale}>
      <NotFoundPage locale={locale} />
    </ShellLayout>
  );
}

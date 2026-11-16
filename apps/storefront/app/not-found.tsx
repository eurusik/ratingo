import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { ShellLayout } from '@/app/layouts';
import { NotFoundPage, notFoundMetadata } from '@/pages/not-found';

export async function generateMetadata(): Promise<Metadata> {
  return notFoundMetadata(await getRequestLocale());
}

export default async function NotFound() {
  const locale = await getRequestLocale();

  return (
    <ShellLayout locale={locale}>
      <NotFoundPage locale={locale} />
    </ShellLayout>
  );
}

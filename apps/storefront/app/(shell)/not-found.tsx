import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { NotFoundPage, notFoundMetadata } from '@/pages/not-found';

export async function generateMetadata(): Promise<Metadata> {
  return notFoundMetadata(await getRequestLocale());
}

export default async function ShellNotFound() {
  return <NotFoundPage locale={await getRequestLocale()} />;
}

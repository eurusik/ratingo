import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { HomePage, homeMetadata } from '@/pages/home';

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getRequestLocale());
}

export default async function HomeRoute() {
  return <HomePage locale={await getRequestLocale()} />;
}

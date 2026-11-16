import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { MyPage, myMetadata } from '@/pages/my';
import { MY_LIST_PARAM } from '@/shared/config';

export async function generateMetadata(): Promise<Metadata> {
  return myMetadata(await getRequestLocale());
}

export default async function MyRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const list = (await searchParams)[MY_LIST_PARAM];
  return <MyPage list={typeof list === 'string' ? list : undefined} />;
}

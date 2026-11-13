import { getRequestLocale } from '@/app/entrypoint';
import { HomePage } from '@/pages/home';

export default async function HomeRoute() {
  return <HomePage locale={await getRequestLocale()} />;
}

import { getDictionary, type Locale } from '@/shared/i18n';
import { SampleList } from './sample-list';

export function MyPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-4 text-2xl font-bold md:px-0">{dict.nav.my}</h1>
      <SampleList />
    </div>
  );
}

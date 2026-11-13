import { buttonVariants } from '@heroui/react';
import { House, WifiOff } from 'lucide-react';
import { HOME_ROUTE } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { ReloadButton } from './reload-button';

export function OfflinePage({ locale }: { locale: Locale }) {
  const { offline } = getDictionary(locale);

  return (
    <div className="page min-h-[60dvh] items-center justify-center text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-surface-secondary"
      >
        <WifiOff className="size-8 text-muted" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{offline.title}</h1>
        <p className="muted">{offline.description}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ReloadButton label={offline.retry} />
        <a href={HOME_ROUTE} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
          <House aria-hidden="true" className="size-4" />
          {offline.home}
        </a>
      </div>
    </div>
  );
}

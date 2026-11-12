import { Button, Spinner } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { TitleImport } from '../model/open-title';
import { TitlePoster } from './title-poster';

interface ImportProgressProps {
  titleImport: TitleImport;
  onRetry: () => void;
  onBack: () => void;
}

export function ImportProgress({ titleImport, onRetry, onBack }: ImportProgressProps) {
  const { dict } = useTranslation();
  const { title, hasFailed } = titleImport;

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <TitlePoster type={title.type} posterUrl={title.posterUrl} />
      {hasFailed ? (
        <>
          <p role="alert" className="text-base text-danger">
            {interpolate(dict.search.importFailed, { title: title.title })}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onPress={onBack}>
              {dict.search.title}
            </Button>
            <Button onPress={onRetry}>{dict.common.retry}</Button>
          </div>
        </>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3">
          <Spinner size="lg" aria-hidden />
          <p className="text-lg font-semibold">{dict.search.preparing}</p>
          <p className="text-sm text-muted">
            {interpolate(dict.search.preparingHint, { title: title.title })}
          </p>
          <Button variant="ghost" onPress={onBack}>
            {dict.search.cancel}
          </Button>
        </div>
      )}
    </div>
  );
}

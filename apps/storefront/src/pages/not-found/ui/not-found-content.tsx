'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TitleLookup } from '@/features/search';
import { useTranslation } from '@/shared/i18n';
import { NotFoundReporter } from '@/shared/lib';
import { ERROR_STATE_TEXT, ERROR_STATE_TITLE } from '@/shared/ui';
import { missingMediaAt } from '../model/missing-media';

const SEARCH_RESULT_LIMIT = 3;

export function NotFoundContent({ watchedNow }: { watchedNow: ReactNode }) {
  const { dict } = useTranslation();
  const pathname = usePathname() ?? '';
  const missing = missingMediaAt(pathname);
  const copy = missing ? dict.notFound.media[missing.type] : dict.notFound.page;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4.5 px-4 pt-24 pb-16 text-center md:max-w-190 md:gap-5 md:pt-18">
      <NotFoundReporter />
      <span
        aria-hidden
        className="text-[88px] leading-none font-black tracking-[-0.05em] text-muted/40 tabular-nums"
      >
        404
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className={ERROR_STATE_TITLE}>{copy.title}</h1>
        <p className={ERROR_STATE_TEXT}>{copy.text}</p>
      </div>
      <TitleLookup
        key={pathname}
        placeholder={dict.notFound.searchPlaceholder}
        initialQuery={missing?.query}
        limit={SEARCH_RESULT_LIMIT}
        fallback={watchedNow}
      />
    </div>
  );
}

'use client';

/**
 * Navigation between journal posts.
 */

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils';

import type { PostNavigation } from '../types';

export interface PostNavigationProps {
  navigation: PostNavigation;
  className?: string;
}

/**
 * Prev/next navigation for journal posts.
 *
 * @example
 * <PostNavigation navigation={post.navigation} />
 */
export function PostNavigationLinks({ navigation, className }: PostNavigationProps) {
  const { t } = useTranslation();
  const { prev, next } = navigation;

  if (!prev && !next) {
    return null;
  }

  return (
    <nav
      aria-label={t('journal.navigation.backToList')}
      className={cn('flex flex-col sm:flex-row gap-4 sm:justify-between', className)}
    >
      {prev ? (
        <Link href={`/journal/${prev.slug}`} className="flex-1">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-3 px-4"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <div className="flex flex-col items-start text-left min-w-0">
              <span className="text-xs text-muted-foreground">
                {t('journal.navigation.previous')}
              </span>
              <span className="text-sm font-medium truncate w-full">
                {prev.title}
              </span>
            </div>
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <Link href={`/journal/${next.slug}`} className="flex-1">
          <Button
            variant="outline"
            className="w-full justify-end gap-2 h-auto py-3 px-4"
          >
            <div className="flex flex-col items-end text-right min-w-0">
              <span className="text-xs text-muted-foreground">
                {t('journal.navigation.next')}
              </span>
              <span className="text-sm font-medium truncate w-full">
                {next.title}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}

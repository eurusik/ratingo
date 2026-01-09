/**
 * Ratingo logo with version badge.
 */

import Link from 'next/link';
import { useTranslation } from '@/shared/i18n';

export function Logo() {
  const { dict } = useTranslation();

  return (
    <Link href="/" className="flex items-baseline shrink-0">
      <span className="text-xl font-bold text-foreground">{dict.meta.siteName}</span>
      <sup className="text-[10px] font-medium text-muted-foreground ml-1">v2</sup>
    </Link>
  );
}

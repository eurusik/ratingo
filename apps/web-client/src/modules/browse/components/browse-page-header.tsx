/**
 * Browse page header with title and back navigation.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';

interface BrowsePageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: Route;
  backLabel?: string;
}

/**
 * Header for browse pages.
 * Shows title, optional subtitle, and back navigation.
 */
export function BrowsePageHeader({
  title,
  subtitle,
  backHref = '/' as Route,
  backLabel = 'Назад',
}: BrowsePageHeaderProps) {
  return (
    <header className="mb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">{backLabel}</span>
      </Link>

      <h1 className="text-3xl font-bold text-white">{title}</h1>
      
      {subtitle && (
        <p className="text-zinc-400 mt-2">{subtitle}</p>
      )}
    </header>
  );
}

import Link from 'next/link';
import { Bookmark, HelpCircle, Bell, ListVideo, History, Pause, XCircle, Upload } from 'lucide-react';

interface EmptyStateProps {
  type: 'forLater' | 'considering' | 'notifications' | 'watchlist' | 'history' | 'paused' | 'dropped';
  title: string;
  description: string;
  showImportCta?: boolean;
  importHint?: string;
  importButtonLabel?: string;
}

const icons = {
  forLater: Bookmark,
  considering: HelpCircle,
  notifications: Bell,
  watchlist: ListVideo,
  history: History,
  paused: Pause,
  dropped: XCircle,
};

const IMPORT_CTA_TYPES: EmptyStateProps['type'][] = ['watchlist', 'history', 'forLater'];

export function EmptyState({
  type,
  title,
  description,
  showImportCta = false,
  importHint = 'Є оцінки на іншому сервісі?',
  importButtonLabel = 'Імпортувати з Кінобази',
}: EmptyStateProps) {
  const Icon = icons[type];
  const shouldShowCta = showImportCta && IMPORT_CTA_TYPES.includes(type);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-[400px]">
      <div className="w-20 h-20 rounded-full bg-cinema-elevated/30 border border-cinema-border/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-cinema-text-muted" />
      </div>
      <h3 className="text-xl font-medium text-cinema-text-primary mb-3">{title}</h3>
      <p className="text-base text-cinema-text-muted max-w-md leading-relaxed">{description}</p>

      {shouldShowCta && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-sm text-cinema-text-muted">{importHint}</p>
          <Link
            href="/settings/import"
            className="inline-flex items-center gap-2 rounded-md border border-cinema-border bg-cinema-card px-4 py-2 text-sm font-medium text-cinema-text-primary hover:border-primary hover:bg-cinema-elevated transition-colors"
          >
            <Upload className="w-4 h-4" />
            {importButtonLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

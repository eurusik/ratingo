'use client';

import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Flag, User, MessageSquare, AlertTriangle, Trash2, Check, X } from 'lucide-react';

import type { ReportWithReviewDto } from '@/core/api/admin-reports.client';
import { cn } from '@/shared/utils';
import { Button, Badge } from '@/shared/ui';

const REASON_LABELS: Record<string, string> = {
  spam: 'Спам',
  harassment: 'Цькування',
  hate_speech: 'Ненависть',
  misinformation: 'Дезінформація',
  spoiler_unmarked: 'Спойлер',
  other: 'Інше',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  reviewed: 'bg-blue-500/20 text-blue-500',
  dismissed: 'bg-zinc-500/20 text-zinc-400',
  actioned: 'bg-green-500/20 text-green-500',
};

interface ReportCardProps {
  report: ReportWithReviewDto;
  onResolve: (reportId: string) => void;
  onDismiss: (reportId: string) => void;
  onAction: (reportId: string) => void;
  isResolving?: boolean;
}

export function ReportCard({
  report,
  onResolve,
  onDismiss,
  onAction,
  isResolving = false,
}: ReportCardProps) {
  const timeAgo = formatDistanceToNow(new Date(report.createdAt), {
    addSuffix: true,
    locale: uk,
  });

  const isPending = report.status === 'pending';

  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-500" />
          <Badge className={cn('text-xs', STATUS_COLORS[report.status])}>
            {report.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {REASON_LABELS[report.reason] || report.reason}
          </Badge>
        </div>
        <span className="text-xs text-zinc-500">{timeAgo}</span>
      </div>

      {/* Reporter info */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <User className="w-4 h-4" />
        <span>
          Скарга від <span className="text-zinc-200">{report.reporter.username}</span>
        </span>
      </div>

      {/* Report details */}
      {report.details && (
        <div className="bg-zinc-800/50 rounded p-3">
          <p className="text-sm text-zinc-300">{report.details}</p>
        </div>
      )}

      {/* Reported review */}
      <div className="border-l-2 border-zinc-700 pl-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400">
            Відгук від <span className="text-zinc-200">{report.review.author.username}</span>
          </span>
          {report.review.hasSpoiler && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
              Спойлер
            </Badge>
          )}
          {report.review.isDeleted && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/50">
              Видалено
            </Badge>
          )}
        </div>
        <p className="text-sm text-zinc-300 bg-zinc-800/30 rounded p-3">
          {report.review.content}
        </p>
      </div>

      {/* Moderator notes */}
      {report.moderatorNotes && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
          <p className="text-xs text-blue-400">
            <strong>Нотатки модератора:</strong> {report.moderatorNotes}
          </p>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve(report.id)}
            disabled={isResolving}
            className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
          >
            <Check className="w-4 h-4 mr-1" />
            Переглянуто
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDismiss(report.id)}
            disabled={isResolving}
            className="text-zinc-400 hover:bg-zinc-800"
          >
            <X className="w-4 h-4 mr-1" />
            Відхилити
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(report.id)}
            disabled={isResolving}
            className="text-red-400 border-red-500/50 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Видалити відгук
          </Button>
        </div>
      )}
    </div>
  );
}

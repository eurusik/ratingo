'use client';

import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Flag, User, MessageSquare, Trash2, Check, X } from 'lucide-react';

import type { ReportWithReviewDto } from '@/core/api/admin-reports.client';
import { ReportStatus, ReportReason } from '@/core/api/report.constants';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button, Badge } from '@/shared/ui';

const STATUS_COLORS: Record<string, string> = {
  [ReportStatus.PENDING]: 'bg-yellow-500/20 text-yellow-500',
  [ReportStatus.REVIEWED]: 'bg-blue-500/20 text-blue-500',
  [ReportStatus.DISMISSED]: 'bg-zinc-500/20 text-cinema-text-muted',
  [ReportStatus.ACTIONED]: 'bg-green-500/20 text-green-500',
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
  const { dict, locale } = useTranslation();
  const t = dict.admin.reports;

  const timeAgo = formatDistanceToNow(new Date(report.createdAt), {
    addSuffix: true,
    locale: locale === 'uk' ? uk : undefined,
  });

  const isPending = report.status === ReportStatus.PENDING;

  const getStatusLabel = (status: string): string => {
    return t.status[status as keyof typeof t.status] || status;
  };

  const getReasonLabel = (reason: string): string => {
    return t.reason[reason as keyof typeof t.reason] || reason;
  };

  return (
    <div className="bg-cinema-card/50 rounded-lg border border-cinema-borderSoft p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-500" />
          <Badge className={cn('text-xs', STATUS_COLORS[report.status])}>
            {getStatusLabel(report.status)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {getReasonLabel(report.reason)}
          </Badge>
        </div>
        <span className="text-xs text-cinema-text-muted">{timeAgo}</span>
      </div>

      {/* Reporter info */}
      <div className="flex items-center gap-2 text-sm text-cinema-text-muted">
        <User className="w-4 h-4" />
        <span>
          {t.card.reportFrom} <span className="text-cinema-text-primary">{report.reporter.username}</span>
        </span>
      </div>

      {/* Report details */}
      {report.details && (
        <div className="bg-cinema-elevated/50 rounded p-3">
          <p className="text-sm text-cinema-text-secondary">{report.details}</p>
        </div>
      )}

      {/* Reported review */}
      <div className="border-l-2 border-cinema-border pl-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-cinema-text-muted" />
          <span className="text-cinema-text-muted">
            {t.card.reviewFrom} <span className="text-cinema-text-primary">{report.review.author.username}</span>
          </span>
          {report.review.hasSpoiler && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
              {t.card.spoiler}
            </Badge>
          )}
          {report.review.isDeleted && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/50">
              {t.card.deleted}
            </Badge>
          )}
        </div>
        <p className="text-sm text-cinema-text-secondary bg-cinema-elevated/30 rounded p-3">
          {report.review.content}
        </p>
      </div>

      {/* Moderator notes */}
      {report.moderatorNotes && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
          <p className="text-xs text-blue-400">
            <strong>{t.card.moderatorNotes}</strong> {report.moderatorNotes}
          </p>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 pt-2 border-t border-cinema-borderSoft">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve(report.id)}
            disabled={isResolving}
            className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
          >
            <Check className="w-4 h-4 mr-1" />
            {t.actions.reviewed}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDismiss(report.id)}
            disabled={isResolving}
            className="text-cinema-text-muted hover:bg-cinema-elevated"
          >
            <X className="w-4 h-4 mr-1" />
            {t.actions.dismiss}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(report.id)}
            disabled={isResolving}
            className="text-red-400 border-red-500/50 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t.actions.deleteReview}
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Flag, Filter } from 'lucide-react';
import { toast } from 'sonner';

import { useAdminReports, useResolveReport } from '@/core/query';
import { ReportStatus, type ReportStatusType } from '@/core/api/report.constants';
import { useTranslation } from '@/shared/i18n';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/shared/ui';

import { ReportCard } from './ReportCard';

const STATUS_FILTER_VALUES = ['all', ...Object.values(ReportStatus)] as const;
type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];

const PAGE_SIZE = 20;

export function ReportsQueue() {
  const { dict } = useTranslation();
  const t = dict.admin.reports;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ReportStatus.PENDING);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useAdminReports({
    status: statusFilter === 'all' ? undefined : statusFilter as ReportStatusType,
    limit: PAGE_SIZE,
    offset,
  });

  const resolveReport = useResolveReport();

  const handleResolve = async (
    reportId: string,
    status: Exclude<ReportStatusType, 'pending'>,
    hideReview = false
  ) => {
    try {
      await resolveReport.mutateAsync({
        reportId,
        status,
        hideReview,
      });
      const toastMessages: Record<string, string> = {
        [ReportStatus.REVIEWED]: t.toast.reviewed,
        [ReportStatus.DISMISSED]: t.toast.dismissed,
        [ReportStatus.ACTIONED]: t.toast.actioned,
      };
      toast.success(toastMessages[status]);
    } catch {
      toast.error(t.toast.error);
    }
  };

  const reports = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  const getFilterLabel = (value: StatusFilter): string => {
    if (value === 'all') return t.filter.all;
    return t.filter[value as keyof typeof t.filter] || value;
  };

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flag className="w-5 h-5 text-red-500" />
          <h1 className="text-xl font-semibold text-zinc-100">{t.title}</h1>
          {total > 0 && (
            <span className="text-sm text-zinc-500">({total})</span>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as StatusFilter);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40 bg-cinema-elevated/50 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-cinema-elevated border-zinc-700">
              {STATUS_FILTER_VALUES.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="text-zinc-300 focus:bg-zinc-700"
                >
                  {getFilterLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t.empty}</p>
          <p className="text-sm mt-1">
            {statusFilter === ReportStatus.PENDING
              ? t.emptyPending
              : t.emptyFiltered}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={(id) => handleResolve(id, ReportStatus.REVIEWED)}
              onDismiss={(id) => handleResolve(id, ReportStatus.DISMISSED)}
              onAction={(id) => handleResolve(id, ReportStatus.ACTIONED, true)}
              isResolving={resolveReport.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            disabled={!hasPrev || isLoading}
          >
            {t.pagination.previous}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            disabled={!hasMore || isLoading}
          >
            {t.pagination.next}
          </Button>
        </div>
      )}
    </div>
  );
}

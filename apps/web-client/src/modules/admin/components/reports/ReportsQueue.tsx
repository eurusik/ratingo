'use client';

import { useState } from 'react';
import { Flag, Filter } from 'lucide-react';
import { toast } from 'sonner';

import { useAdminReports, useResolveReport } from '@/core/query';
import type { ReportStatus } from '@/core/api/admin-reports.client';
import { cn } from '@/shared/utils';
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

const STATUS_OPTIONS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Всі' },
  { value: 'pending', label: 'Очікують' },
  { value: 'reviewed', label: 'Переглянуті' },
  { value: 'dismissed', label: 'Відхилені' },
  { value: 'actioned', label: 'З діями' },
];

const PAGE_SIZE = 20;

export function ReportsQueue() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('pending');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useAdminReports({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset,
  });

  const resolveReport = useResolveReport();

  const handleResolve = async (reportId: string, status: Exclude<ReportStatus, 'pending'>, hideReview = false) => {
    try {
      await resolveReport.mutateAsync({
        reportId,
        status,
        hideReview,
      });
      toast.success(
        status === 'reviewed'
          ? 'Скаргу позначено як переглянуту'
          : status === 'dismissed'
            ? 'Скаргу відхилено'
            : 'Відгук видалено'
      );
    } catch {
      toast.error('Не вдалося обробити скаргу');
    }
  };

  const reports = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Помилка завантаження скарг</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flag className="w-5 h-5 text-red-500" />
          <h1 className="text-xl font-semibold text-zinc-100">Черга скарг</h1>
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
              setStatusFilter(value as ReportStatus | 'all');
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40 bg-zinc-800/50 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-zinc-300 focus:bg-zinc-700"
                >
                  {option.label}
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
          <p className="text-lg">Немає скарг</p>
          <p className="text-sm mt-1">
            {statusFilter === 'pending'
              ? 'Всі скарги оброблено'
              : 'Скарги з таким статусом відсутні'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={(id) => handleResolve(id, 'reviewed')}
              onDismiss={(id) => handleResolve(id, 'dismissed')}
              onAction={(id) => handleResolve(id, 'actioned', true)}
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
            Попередні
          </Button>
          <Button
            variant="outline"
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            disabled={!hasMore || isLoading}
          >
            Наступні
          </Button>
        </div>
      )}
    </div>
  );
}

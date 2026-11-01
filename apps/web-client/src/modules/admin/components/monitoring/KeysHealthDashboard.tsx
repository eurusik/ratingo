'use client';

import { AlertTriangle, KeyRound, RefreshCw } from 'lucide-react';

import { useKeyHealth, useCheckKeysNow } from '@/core/query';
import type { ProviderKeyHealth } from '@/core/api/admin-monitoring.client';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const STATUS_DOT: Record<string, string> = {
  valid: 'bg-green-500',
  degraded: 'bg-amber-500',
  invalid: 'bg-red-500',
  unknown: 'bg-gray-500',
};

const UNKNOWN_STATUS = 'unknown';

const PROVIDER_LABEL: Record<string, string> = {
  tmdb: 'TMDB',
  trakt: 'Trakt',
  mdblist: 'MDBList',
  omdb: 'OMDb',
  s3: 'S3 / R2',
};

const EMPTY_VALUE = '—';
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

interface RelativeTimeLabels {
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
}

interface RowLabels {
  status: Record<string, string>;
  time: RelativeTimeLabels;
  latencyValue: string;
}

const withCount = (template: string, count: number): string =>
  template.replace('{count}', String(count));

function formatRelative(iso: string | null, time: RelativeTimeLabels): string {
  if (!iso) return EMPTY_VALUE;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return EMPTY_VALUE;
  const minutes = Math.round(diffMs / MS_PER_MINUTE);
  if (minutes < 1) return time.justNow;
  if (minutes < MINUTES_PER_HOUR) return withCount(time.minutesAgo, minutes);
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return withCount(time.hoursAgo, hours);
  return withCount(time.daysAgo, Math.round(hours / HOURS_PER_DAY));
}

function StatusCell({
  status,
  labels,
}: {
  status: string | undefined;
  labels: Record<string, string>;
}) {
  const key = status && STATUS_DOT[status] ? status : UNKNOWN_STATUS;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[key])} aria-hidden />
      <span>{labels[key]}</span>
    </span>
  );
}

function ProviderRow({ row, labels }: { row: ProviderKeyHealth; labels: RowLabels }) {
  const { latest, failures } = row;
  const hasPassive = failures.unauthorized > 0 || failures.rateLimited > 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{PROVIDER_LABEL[row.provider] ?? row.provider}</TableCell>
      <TableCell>
        <StatusCell status={latest?.status} labels={labels.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {latest?.latencyMs != null ? withCount(labels.latencyValue, latest.latencyMs) : EMPTY_VALUE}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelative(latest?.checkedAt ?? null, labels.time)}
      </TableCell>
      <TableCell>
        {hasPassive ? (
          <span className="inline-flex items-center gap-1 text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            {failures.unauthorized > 0 && <span>{failures.unauthorized}×401/403</span>}
            {failures.rateLimited > 0 && <span>{failures.rateLimited}×429</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{EMPTY_VALUE}</span>
        )}
      </TableCell>
      <TableCell
        className="max-w-[320px] truncate text-muted-foreground"
        title={latest?.detail ?? ''}
      >
        {latest?.detail ?? EMPTY_VALUE}
      </TableCell>
    </TableRow>
  );
}

export function KeysHealthDashboard() {
  const { dict } = useTranslation();
  const { data, isLoading, isError, refetch } = useKeyHealth();
  const checkNow = useCheckKeysNow();

  const labels = dict.admin?.monitoring ?? {};
  const providers = data?.providers ?? [];
  const rowLabels: RowLabels = {
    status: {
      valid: labels.status?.valid ?? 'Валідний',
      degraded: labels.status?.degraded ?? 'Деградація',
      invalid: labels.status?.invalid ?? 'Невалідний',
      unknown: labels.status?.unknown ?? 'Невідомо',
    },
    time: {
      justNow: labels.time?.justNow ?? 'щойно',
      minutesAgo: labels.time?.minutesAgo ?? '{count} хв тому',
      hoursAgo: labels.time?.hoursAgo ?? '{count} год тому',
      daysAgo: labels.time?.daysAgo ?? '{count} дн тому',
    },
    latencyValue: labels.latencyValue ?? '{count} мс',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {labels.title ?? 'Моніторинг ключів'}
            </CardTitle>
            <CardDescription>
              {labels.description ??
                'Активний probe + пасивні лічильники реальних 401/403/429 за добу. Автооновлення щохвилини.'}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkNow.mutate()}
              disabled={checkNow.isPending}
            >
              <RefreshCw
                className={cn(
                  'mr-2 h-4 w-4',
                  checkNow.isPending && 'animate-spin motion-reduce:animate-none',
                )}
              />
              {labels.checkNow ?? 'Перевірити зараз'}
            </Button>
            {checkNow.isError && (
              <span className="text-xs text-red-500">
                {labels.checkError ?? 'Не вдалося перевірити. Спробуйте ще раз.'}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4 text-sm">
              <span className="text-muted-foreground">
                {labels.error ?? 'Не вдалося завантажити стан ключів.'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                {labels.retry ?? 'Повторити'}
              </Button>
            </div>
          ) : (
            <div aria-live="polite" aria-busy={isLoading || checkNow.isPending}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labels.columns?.provider ?? 'Провайдер'}</TableHead>
                    <TableHead>{labels.columns?.status ?? 'Статус'}</TableHead>
                    <TableHead>{labels.columns?.latency ?? 'Затримка'}</TableHead>
                    <TableHead>{labels.columns?.checkedAt ?? 'Перевірено'}</TableHead>
                    <TableHead>{labels.columns?.passive ?? 'Збої (24 год)'}</TableHead>
                    <TableHead>{labels.columns?.detail ?? 'Деталі'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {labels.loading ?? 'Завантаження…'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    providers.map((row) => (
                      <ProviderRow key={row.provider} row={row} labels={rowLabels} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client"

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { DataTable, StatusBadge } from '@/modules/admin'
import { DataTableColumnDef } from '@/modules/admin/types'
import type { components } from '@ratingo/api-contract'

type EvaluationRunDto = components['schemas']['EvaluationRunDto']

interface PolicyRunsTabProps {
  runs: EvaluationRunDto[] | undefined
  labels: {
    title: string
    description: string
    runId: string
    status: string
    progress: string
    started: string
    finished: string
    empty: string
    emptyHint: string
    viewDetails: string
  }
}

/**
 * Displays policy evaluation runs tab.
 * 
 * Shows table of runs with status, progress, and timestamps.
 * Includes empty state when no runs exist.
 *
 * @param runs - Array of evaluation runs
 * @param labels - Localized labels for table
 */
export function PolicyRunsTab({ runs, labels }: PolicyRunsTabProps) {
  const router = useRouter()

  const columns: DataTableColumnDef<EvaluationRunDto>[] = [
    {
      id: 'id',
      header: labels.runId,
      accessorKey: 'id',
      cell: ({ row }) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">{row.original.id}</code>
      ),
    },
    {
      id: 'status',
      header: labels.status,
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'progress',
      header: labels.progress,
      cell: ({ row }) => {
        const { processed, total } = row.original.progress
        const percentage = Math.round((processed / total) * 100)
        return (
          <div className="w-24">
            <Progress value={percentage} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {processed}/{total}
            </div>
          </div>
        )
      },
    },
    {
      id: 'startedAt',
      header: labels.started,
      accessorKey: 'startedAt',
      cell: ({ row }) =>
        new Date(row.original.startedAt).toLocaleDateString('uk-UA', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      id: 'finishedAt',
      header: labels.finished,
      accessorKey: 'finishedAt',
      cell: ({ row }) => {
        if (!row.original.finishedAt) return '-'
        return new Date(row.original.finishedAt).toLocaleDateString('uk-UA', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{labels.description}</p>
      </CardHeader>
      <CardContent>
        {!runs || runs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{labels.empty}</p>
            <p className="text-sm mt-1">{labels.emptyHint}</p>
          </div>
        ) : (
          <DataTable
            data={runs}
            columns={columns}
            rowActions={(run) => [
              {
                label: labels.viewDetails,
                onClick: () => router.push(`/admin/runs/${run.id}`),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Badge } from '../../../shared/ui/badge'
import { Progress } from '../../../shared/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import { DataTable, StatusBadge } from '@/modules/admin'
import { DataTableColumnDef, RUN_STATUS } from '@/modules/admin/types'
import { useTranslation } from '@/shared/i18n'
import { useFilteredRuns } from '../../../core/query/admin'
import { type EvaluationRunDto } from '../../../core/api/admin'

export default function RunsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { dict } = useTranslation()
  
  const { data: runs = [], isLoading, error } = useFilteredRuns(statusFilter)

  const columns: DataTableColumnDef<EvaluationRunDto>[] = [
    {
      id: 'id',
      header: dict.admin.runs.columns.runId,
      accessorKey: 'id',
      cell: ({ row }) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">
          {row.original.id}
        </code>
      )
    },
    {
      id: 'policyName',
      header: dict.admin.runs.columns.policy,
      accessorKey: 'policyName',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.policyName}</div>
      )
    },
    {
      id: 'status',
      header: dict.admin.runs.columns.status,
      accessorKey: 'status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    },
    {
      id: 'progress',
      header: dict.admin.runs.columns.progress,
      cell: ({ row }) => {
        const { processed, total, eligible, ineligible, pending, errors } = row.original.progress
        const percentage = Math.round((processed / total) * 100)
        
        return (
          <div className="space-y-2 min-w-[200px]">
            <div className="flex items-center space-x-2">
              <Progress value={percentage} className="h-2 w-20" />
              <span className="text-xs text-muted-foreground">
                {processed}/{total}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs px-2 py-0.5 whitespace-nowrap">
                {eligible} {dict.admin.runs.progress.eligible}
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-0.5 whitespace-nowrap">
                {ineligible} {dict.admin.runs.progress.ineligible}
              </Badge>
              {pending > 0 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 whitespace-nowrap">
                  {pending} {dict.admin.runs.progress.pending}
                </Badge>
              )}
              {errors > 0 && (
                <Badge variant="destructive" className="text-xs px-2 py-0.5 whitespace-nowrap">
                  {errors} {dict.admin.runs.progress.errors}
                </Badge>
              )}
            </div>
          </div>
        )
      }
    },
    {
      id: 'startedAt',
      header: dict.admin.runs.columns.started,
      accessorKey: 'startedAt',
      cell: ({ row }) => {
        const date = new Date(row.original.startedAt)
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString('uk-UA')}</div>
            <div className="text-muted-foreground">
              {date.toLocaleTimeString('uk-UA', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        )
      }
    },
    {
      id: 'duration',
      header: dict.admin.runs.columns.duration,
      cell: ({ row }) => {
        const start = new Date(row.original.startedAt)
        const end = row.original.finishedAt ? new Date(row.original.finishedAt) : new Date()
        const duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60) // minutes
        
        if (row.original.status === RUN_STATUS.RUNNING) {
          return <span className="text-muted-foreground">{duration}{dict.admin.runs.duration.minutes} ({dict.admin.runs.duration.running})</span>
        }
        
        return <span className="text-sm">{duration}{dict.admin.runs.duration.minutes}</span>
      }
    }
  ]

  const handleRunClick = (run: EvaluationRunDto) => {
    router.push(`/admin/runs/${run.id}`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.runs.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {dict.admin.runs.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={dict.admin.runs.filters.status || 'Filter by status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dict.admin.runs.filters.allStatuses}</SelectItem>
                <SelectItem value="running">{dict.admin.runs.filters.running}</SelectItem>
                <SelectItem value="prepared">{dict.admin.runs.filters.prepared}</SelectItem>
                <SelectItem value="failed">{dict.admin.runs.filters.failed}</SelectItem>
                <SelectItem value="cancelled">{dict.admin.runs.filters.cancelled}</SelectItem>
                <SelectItem value="promoted">{dict.admin.runs.filters.promoted}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DataTable
            data={runs}
            columns={columns}
            loading={isLoading}
            error={error?.message}
            rowActions={(run) => [
              {
                label: dict.admin.policyDetail.actions.viewDetails,
                onClick: () => handleRunClick(run)
              }
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
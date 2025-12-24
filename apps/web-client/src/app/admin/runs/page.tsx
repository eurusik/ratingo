"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Badge } from '../../../shared/ui/badge'
import { Progress } from '../../../shared/ui/progress'
import { DataTable, StatusBadge, FilterBar } from '../../../modules/admin'
import { DataTableColumnDef, RunStatus, FilterConfig } from '../../../modules/admin/types'
import { useTranslation } from '../../../shared/i18n'
import { useRuns } from '../../../core/query'
import { type EvaluationRun } from '../../../core/api'

export default function RunsPage() {
  const [searchValue, setSearchValue] = useState('')
  const { dict } = useTranslation()
  
  const { data: runs = [], isLoading, error } = useRuns()

  const columns: DataTableColumnDef<EvaluationRun>[] = [
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
        
        if (row.original.status === RunStatus.RUNNING) {
          return <span className="text-muted-foreground">{duration}{dict.admin.runs.duration.minutes} ({dict.admin.runs.duration.running})</span>
        }
        
        return <span className="text-sm">{duration}{dict.admin.runs.duration.minutes}</span>
      }
    }
  ]

  const filters: FilterConfig[] = [
    {
      key: 'status',
      label: dict.admin.runs.filters.status || 'Status',
      type: 'select',
      options: [
        { label: dict.admin.runs.filters.allStatuses, value: 'all' },
        { label: dict.admin.runs.filters.running, value: RunStatus.RUNNING },
        { label: dict.admin.runs.filters.success, value: RunStatus.SUCCESS },
        { label: dict.admin.runs.filters.failed, value: RunStatus.FAILED },
        { label: dict.admin.runs.filters.promoted, value: RunStatus.PROMOTED }
      ]
    },
    {
      key: 'policy',
      label: dict.admin.runs.filters.policy || 'Policy',
      type: 'select',
      options: [
        { label: dict.admin.runs.filters.allPolicies, value: 'all' },
        { label: dict.admin.runs.filters.contentFiltering || 'Content Filtering Policy', value: 'content-filtering' },
        { label: dict.admin.runs.filters.ratingValidation || 'Rating Validation Policy', value: 'rating-validation' },
        { label: dict.admin.runs.filters.userModeration || 'User Moderation Policy', value: 'user-moderation' }
      ]
    }
  ]

  const handleRunClick = (run: EvaluationRun) => {
    // TODO: Navigate to run detail
    // router.push(`/admin/runs/${run.id}`)
  }

  const filteredRuns = runs.filter(run => 
    run.policyName.toLowerCase().includes(searchValue.toLowerCase()) ||
    run.id.toLowerCase().includes(searchValue.toLowerCase())
  )

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
          <FilterBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filters}
          />
          
          <DataTable
            data={filteredRuns}
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
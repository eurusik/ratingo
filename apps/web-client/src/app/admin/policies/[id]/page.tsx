"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Badge } from '@/shared/ui/badge'
import { DataTable, StatusBadge } from '@/modules/admin'
import { DataTableColumnDef, RunStatus, RunStatusType } from '@/modules/admin/types'
import { Progress } from '@/shared/ui/progress'

interface PolicyRun {
  id: string
  status: RunStatusType
  progress: {
    processed: number
    total: number
  }
  startedAt: string
  finishedAt?: string
}

interface Policy {
  id: string
  name: string
  version: string
  active: boolean
  description: string
  rules: string[]
  updatedAt: string
}

// Mock data
const mockPolicy: Policy = {
  id: '1',
  name: 'Content Filtering Policy',
  version: '1.2.0',
  active: true,
  description: 'Filters inappropriate content based on rating and content descriptors',
  rules: [
    'Block content with rating above R',
    'Filter explicit language',
    'Validate content metadata'
  ],
  updatedAt: '2024-12-20T10:30:00Z'
}

const mockRuns: PolicyRun[] = [
  {
    id: 'run-001',
    status: RunStatus.SUCCESS,
    progress: { processed: 1000, total: 1000 },
    startedAt: '2024-12-20T10:30:00Z',
    finishedAt: '2024-12-20T11:15:00Z'
  },
  {
    id: 'run-002',
    status: RunStatus.RUNNING,
    progress: { processed: 750, total: 1200 },
    startedAt: '2024-12-20T14:00:00Z'
  },
  {
    id: 'run-003',
    status: RunStatus.FAILED,
    progress: { processed: 300, total: 800 },
    startedAt: '2024-12-19T16:30:00Z',
    finishedAt: '2024-12-19T16:45:00Z'
  }
]

export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const [policy] = useState<Policy>(mockPolicy)
  const [runs] = useState<PolicyRun[]>(mockRuns)

  const runsColumns: DataTableColumnDef<PolicyRun>[] = [
    {
      id: 'id',
      header: 'Run ID',
      accessorKey: 'id',
      cell: ({ row }) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">
          {row.original.id}
        </code>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    },
    {
      id: 'progress',
      header: 'Progress',
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
      }
    },
    {
      id: 'startedAt',
      header: 'Started',
      accessorKey: 'startedAt',
      cell: ({ row }) => {
        const date = new Date(row.original.startedAt)
        return date.toLocaleDateString('uk-UA', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    },
    {
      id: 'finishedAt',
      header: 'Finished',
      accessorKey: 'finishedAt',
      cell: ({ row }) => {
        if (!row.original.finishedAt) return '-'
        const date = new Date(row.original.finishedAt)
        return date.toLocaleDateString('uk-UA', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    }
  ]

  const handleRunClick = (run: PolicyRun) => {
    // TODO: Navigate to run detail
    // router.push(`/admin/runs/${run.id}`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Policy Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                {policy.name}
                <Badge variant="outline">v{policy.version}</Badge>
                <Badge variant={policy.active ? 'default' : 'secondary'}>
                  {policy.active ? 'Active' : 'Inactive'}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {new Date(policy.updatedAt).toLocaleDateString('uk-UA')}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Runs</CardTitle>
              <p className="text-sm text-muted-foreground">
                History of policy evaluation runs
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                data={runs}
                columns={runsColumns}
                rowActions={(run) => [
                  {
                    label: 'View Details',
                    onClick: () => handleRunClick(run)
                  }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {policy.description}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Rules</h4>
                <ul className="space-y-2">
                  {policy.rules.map((rule, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start">
                      <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <h4 className="text-sm font-medium">Version</h4>
                  <p className="text-sm text-muted-foreground">{policy.version}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Status</h4>
                  <Badge variant={policy.active ? 'default' : 'secondary'} className="mt-1">
                    {policy.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
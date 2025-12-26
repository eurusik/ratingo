"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DataTable, StatusBadge } from '@/modules/admin'
import { DataTableColumnDef, POLICY_STATUS } from '@/modules/admin/types'
import { Progress } from '@/shared/ui/progress'
import { usePolicies, useRunsByPolicy, usePreparePolicy } from '@/core/query/admin'
import { Loader2, AlertCircle, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/shared/i18n'
import type { components } from '@ratingo/api-contract'

type EvaluationRunDto = components['schemas']['EvaluationRunDto']
type PolicyDto = components['schemas']['PolicyDto']

// Helper to get badge variant for policy status
const getPolicyBadgeVariant = (status: string) => {
  return status === POLICY_STATUS.ACTIVE ? 'default' : 'secondary'
}

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { dict } = useTranslation()
  const resolvedParams = React.use(params)
  const policyId = resolvedParams.id
  
  const { data: policies, isLoading: policiesLoading, error: policiesError, refetch: refetchPolicies } = usePolicies()
  const { data: runs, isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useRunsByPolicy(policyId)
  const preparePolicy = usePreparePolicy()

  const policy = policies?.find(p => p.id === policyId)

  // Handle prepare action
  const handlePrepare = async () => {
    if (!policy) return

    try {
      await preparePolicy.mutateAsync({ policyId: policy.id })
      toast.success(dict.admin.policyDetail.toast.prepareSuccess)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.admin.policyDetail.toast.prepareFailed)
    }
  }

  // Loading state
  if (policiesLoading || runsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (policiesError || runsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{dict.admin.common.error}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {policiesError?.message || runsError?.message || dict.admin.common.error}
          </p>
        </div>
        <Button onClick={() => {
          refetchPolicies()
          refetchRuns()
        }}>
          {dict.admin.common.tryAgain}
        </Button>
      </div>
    )
  }

  // Policy not found
  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{dict.admin.policyDetail.notFound}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {dict.admin.policyDetail.notFoundDescription.replace('{id}', policyId)}
          </p>
        </div>
        <Button onClick={() => router.push('/admin/policies')}>
          {dict.admin.policyDetail.backToPolicies}
        </Button>
      </div>
    )
  }

  const runsColumns: DataTableColumnDef<EvaluationRunDto>[] = [
    {
      id: 'id',
      header: dict.admin.policyDetail.runsTable.runId,
      accessorKey: 'id',
      cell: ({ row }) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">
          {row.original.id}
        </code>
      )
    },
    {
      id: 'status',
      header: dict.admin.policyDetail.runsTable.status,
      accessorKey: 'status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    },
    {
      id: 'progress',
      header: dict.admin.policyDetail.runsTable.progress,
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
      header: dict.admin.policyDetail.runsTable.started,
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
      header: dict.admin.policyDetail.runsTable.finished,
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

  const handleRunClick = (run: EvaluationRunDto) => {
    router.push(`/admin/runs/${run.id}`)
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
                <Badge variant={getPolicyBadgeVariant(policy.status)}>
                  {policy.status === POLICY_STATUS.ACTIVE ? dict.admin.policies.status.active : dict.admin.policies.status.inactive}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {dict.admin.policyDetail.lastUpdated}: {new Date(policy.updatedAt).toLocaleDateString('uk-UA')}
              </p>
            </div>
            <Button 
              onClick={handlePrepare} 
              disabled={preparePolicy.isPending}
            >
              {preparePolicy.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dict.admin.policyDetail.actions.preparing}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {dict.admin.policyDetail.actions.prepare}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">{dict.admin.policyDetail.tabs.runs}</TabsTrigger>
          <TabsTrigger value="policy">{dict.admin.policyDetail.tabs.policy}</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.policyDetail.runsTable.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {dict.admin.policyDetail.runsTable.description}
              </p>
            </CardHeader>
            <CardContent>
              {!runs || runs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{dict.admin.policyDetail.runsTable.empty}</p>
                  <p className="text-sm mt-1">{dict.admin.policyDetail.runsTable.emptyHint}</p>
                </div>
              ) : (
                <DataTable
                  data={runs}
                  columns={runsColumns}
                  rowActions={(run) => [
                    {
                      label: dict.admin.policyDetail.actions.viewDetails,
                      onClick: () => handleRunClick(run)
                    }
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.admin.policyDetail.policyInfo.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {policy.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{dict.admin.policyDetail.policyInfo.description}</h4>
                  <p className="text-sm text-muted-foreground">
                    {policy.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <h4 className="text-sm font-medium">{dict.admin.policyDetail.policyInfo.version}</h4>
                  <p className="text-sm text-muted-foreground">{policy.version}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium">{dict.admin.policyDetail.policyInfo.status}</h4>
                  <Badge variant={getPolicyBadgeVariant(policy.status)} className="mt-1">
                    {policy.status === POLICY_STATUS.ACTIVE ? dict.admin.policies.status.active : dict.admin.policies.status.inactive}
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

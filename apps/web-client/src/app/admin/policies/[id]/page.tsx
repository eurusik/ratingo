"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Button } from '@/shared/ui/button'
import { PolicyHeader, PolicyRunsTab, PolicyConfigTab } from '@/modules/admin'
import { usePolicyDetail, useRunsByPolicy, usePreparePolicy } from '@/core/query/admin'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/shared/i18n'

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { dict } = useTranslation()
  const resolvedParams = React.use(params)
  const policyId = resolvedParams.id

  const { data: policy, isLoading: policyLoading, error: policyError, refetch: refetchPolicy } = usePolicyDetail(policyId)
  const { data: runs, isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useRunsByPolicy(policyId)
  const preparePolicy = usePreparePolicy()

  const handlePrepare = async () => {
    if (!policy) return
    try {
      await preparePolicy.mutateAsync({ policyId: policy.id })
      toast.success(dict.admin.policyDetail.toast.prepareSuccess)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.admin.policyDetail.toast.prepareFailed)
    }
  }

  if (policyLoading || runsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (policyError || runsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{dict.admin.common.error}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {policyError?.message || runsError?.message || dict.admin.common.error}
          </p>
        </div>
        <Button onClick={() => { refetchPolicy(); refetchRuns() }}>
          {dict.admin.common.tryAgain}
        </Button>
      </div>
    )
  }

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PolicyHeader
        name={policy.name}
        version={policy.version}
        status={policy.status}
        lastUpdated={policy.activatedAt ?? policy.createdAt}
        onPrepare={handlePrepare}
        isPreparing={preparePolicy.isPending}
        labels={{
          active: dict.admin.policies.status.active,
          inactive: dict.admin.policies.status.inactive,
          lastUpdated: dict.admin.policyDetail.lastUpdated,
          prepare: dict.admin.policyDetail.actions.prepare,
          preparing: dict.admin.policyDetail.actions.preparing,
        }}
      />

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">{dict.admin.policyDetail.tabs.runs}</TabsTrigger>
          <TabsTrigger value="policy">{dict.admin.policyDetail.tabs.policy}</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <PolicyRunsTab
            runs={runs}
            labels={{
              ...dict.admin.policyDetail.runsTable,
              viewDetails: dict.admin.policyDetail.actions.viewDetails,
            }}
          />
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <PolicyConfigTab
            config={policy.config}
            version={policy.version}
            status={policy.status}
            labels={{
              config: dict.admin.policyDetail.config,
              policyInfo: dict.admin.policyDetail.policyInfo,
              statusLabels: dict.admin.policies.status,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

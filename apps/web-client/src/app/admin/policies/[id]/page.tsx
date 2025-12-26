"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Button } from '@/shared/ui/button'
import { PolicyHeader, PolicyRunsTab, PolicyConfigTab, type PolicyFormData } from '@/modules/admin'
import { usePolicyDetail, useRunsByPolicy, usePreparePolicy, useCreatePolicy } from '@/core/query/admin'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/shared/i18n'

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { dict } = useTranslation()
  const resolvedParams = React.use(params)
  const policyId = resolvedParams.id

  const [isEditing, setIsEditing] = useState(false)

  const { data: policy, isLoading: policyLoading, error: policyError, refetch: refetchPolicy } = usePolicyDetail(policyId)
  const { data: runs, isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useRunsByPolicy(policyId)
  const preparePolicy = usePreparePolicy()
  const createPolicy = useCreatePolicy()

  const handlePrepare = async () => {
    if (!policy) return
    try {
      await preparePolicy.mutateAsync({ policyId: policy.id })
      toast.success(dict.admin.policyDetail.toast.prepareSuccess)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.admin.policyDetail.toast.prepareFailed)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleSave = async (data: PolicyFormData) => {
    try {
      const result = await createPolicy.mutateAsync({
        allowedCountries: data.allowedCountries as unknown as unknown[][],
        blockedCountries: data.blockedCountries as unknown as unknown[][],
        blockedCountryMode: data.blockedCountryMode,
        allowedLanguages: data.allowedLanguages as unknown as unknown[][],
        blockedLanguages: data.blockedLanguages as unknown as unknown[][],
        globalProviders: data.globalProviders as unknown as unknown[][],
        breakoutRules: data.breakoutRules as unknown as unknown[][],
        eligibilityMode: data.eligibilityMode,
        homepage: data.homepage as unknown as Record<string, never>,
      })
      
      toast.success(dict.admin.policyDetail.toast.saveSuccess ?? `Policy v${result.version} created`)
      setIsEditing(false)
      
      // Navigate to new policy
      router.push(`/admin/policies/${result.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.admin.policyDetail.toast.saveFailed ?? 'Failed to save policy')
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
        onEdit={handleEdit}
        isPreparing={preparePolicy.isPending}
        isEditing={isEditing}
        labels={{
          active: dict.admin.policies.status.active,
          inactive: dict.admin.policies.status.inactive,
          lastUpdated: dict.admin.policyDetail.lastUpdated,
          prepare: dict.admin.policyDetail.actions.prepare,
          preparing: dict.admin.policyDetail.actions.preparing,
          edit: dict.admin.policyDetail.actions.edit ?? 'Edit',
        }}
      />

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs" disabled={isEditing}>{dict.admin.policyDetail.tabs.runs}</TabsTrigger>
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
            isEditing={isEditing}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
            isSaving={createPolicy.isPending}
            labels={{
              config: dict.admin.policyDetail.config,
              policyInfo: dict.admin.policyDetail.policyInfo,
              statusLabels: dict.admin.policies.status,
              edit: {
                save: dict.admin.policyDetail.actions.save ?? 'Save as New Version',
                saving: dict.admin.policyDetail.actions.saving ?? 'Saving...',
                cancel: dict.admin.common.cancel ?? 'Cancel',
              },
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { toast } from 'sonner'
import { useTranslation } from '@/shared/i18n'
import { usePolicyDetail, useCreatePolicy } from '@/core/query/admin'
import { DraftHeader, PolicyEditForm, type PolicyFormData } from '@/modules/admin'
import type { PolicyConfigDto } from '@/core/api/admin'

/**
 * Empty policy configuration for creating from scratch.
 */
const EMPTY_POLICY_CONFIG: PolicyConfigDto = {
  allowedCountries: [],
  blockedCountries: [],
  blockedCountryMode: 'ANY',
  allowedLanguages: [],
  blockedLanguages: [],
  globalProviders: [],
  breakoutRules: [],
  eligibilityMode: 'STRICT',
  homepage: { minRelevanceScore: 0 },
}

export default function PolicyDraftPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dict } = useTranslation()
  
  const baseId = searchParams.get('base')
  const { data: basePolicy, isLoading, error } = usePolicyDetail(baseId ?? '', !!baseId)
  const createPolicy = useCreatePolicy()

  const handleSave = async (data: PolicyFormData) => {
    try {
      const result = await createPolicy.mutateAsync({
        allowedCountries: data.allowedCountries,
        blockedCountries: data.blockedCountries,
        blockedCountryMode: data.blockedCountryMode,
        allowedLanguages: data.allowedLanguages,
        blockedLanguages: data.blockedLanguages,
        globalProviders: data.globalProviders,
        breakoutRules: data.breakoutRules,
        eligibilityMode: data.eligibilityMode,
        homepage: data.homepage,
        globalRequirements: data.globalRequirements,
      })
      
      toast.success(dict.admin.policyDraft.toast.success ?? `Policy v${result.version} created`)
      router.push(`/admin/policies/${result.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.admin.policyDraft.toast.failed)
    }
  }

  const handleCancel = () => {
    router.push('/admin/policies')
  }

  // Loading state when fetching base policy
  if (baseId && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (baseId && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{dict.admin.common.error}</h3>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        </div>
        <Button onClick={() => router.push('/admin/policies')}>
          {dict.admin.policyDetail.backToPolicies}
        </Button>
      </div>
    )
  }

  const config = basePolicy?.config ?? EMPTY_POLICY_CONFIG
  const formLabels = dict.admin.policyDetail.form

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <DraftHeader
        baseVersion={basePolicy?.version}
        labels={{
          title: dict.admin.policyDraft.title,
          basedOn: dict.admin.policyDraft.basedOn,
          fromScratch: dict.admin.policyDraft.fromScratch,
        }}
      />

      <PolicyEditForm
        initialConfig={config}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={createPolicy.isPending}
        labels={formLabels}
      />
    </div>
  )
}

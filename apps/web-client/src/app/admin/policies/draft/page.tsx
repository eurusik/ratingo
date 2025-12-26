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
  const labels = dict.admin.policyDraft

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <DraftHeader
        baseVersion={basePolicy?.version}
        labels={{
          title: labels.title,
          basedOn: labels.basedOn,
          fromScratch: labels.fromScratch,
        }}
      />

      <PolicyEditForm
        initialConfig={config}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={createPolicy.isPending}
        labels={{
          save: labels.save,
          saving: labels.saving,
          cancel: dict.admin.common.cancel,
          countries: {
            title: dict.admin.policyDetail.config.countries,
            description: dict.admin.policyDetail.config.countriesDescription,
            allowed: dict.admin.policyDetail.config.allowed,
            blocked: dict.admin.policyDetail.config.blocked,
            allowedPlaceholder: dict.admin.policyDetail.config.allowedCountryPlaceholder,
            blockedPlaceholder: dict.admin.policyDetail.config.blockedCountryPlaceholder,
          },
          languages: {
            title: dict.admin.policyDetail.config.languages,
            description: dict.admin.policyDetail.config.languagesDescription,
            allowed: dict.admin.policyDetail.config.allowed,
            blocked: dict.admin.policyDetail.config.blocked,
            allowedPlaceholder: dict.admin.policyDetail.config.allowedLanguagePlaceholder,
            blockedPlaceholder: dict.admin.policyDetail.config.blockedLanguagePlaceholder,
          },
          providers: {
            title: dict.admin.policyDetail.config.providers,
            description: dict.admin.policyDetail.config.providersDescription,
            placeholder: dict.admin.policyDetail.config.providersPlaceholder,
            searchPlaceholder: dict.admin.policyDetail.config.providersSearchPlaceholder,
            emptyText: dict.admin.policyDetail.config.providersEmptyText,
          },
          settings: {
            title: dict.admin.policyDetail.config.settings,
            description: dict.admin.policyDetail.config.settingsDescription,
            eligibilityMode: dict.admin.policyDetail.config.eligibilityMode,
            eligibilityModeHint: dict.admin.policyDetail.config.eligibilityModeHint,
            strictLabel: dict.admin.policyDetail.config.strictLabel,
            strictDescription: dict.admin.policyDetail.config.strictDescription,
            relaxedLabel: dict.admin.policyDetail.config.relaxedLabel,
            relaxedDescription: dict.admin.policyDetail.config.relaxedDescription,
            blockedCountryMode: dict.admin.policyDetail.config.blockedCountryMode,
            blockedCountryModeHint: dict.admin.policyDetail.config.blockedCountryModeHint,
            anyLabel: dict.admin.policyDetail.config.anyLabel,
            anyDescription: dict.admin.policyDetail.config.anyDescription,
            majorityLabel: dict.admin.policyDetail.config.majorityLabel,
            majorityDescription: dict.admin.policyDetail.config.majorityDescription,
            minRelevanceScore: dict.admin.policyDetail.config.minRelevanceScore,
            minRelevanceScoreHint: dict.admin.policyDetail.config.minRelevanceScoreHint,
          },
          breakoutRules: {
            title: dict.admin.policyDetail.config.breakoutRules,
            description: dict.admin.policyDetail.config.breakoutRulesDescription,
            priority: dict.admin.policyDetail.config.priority,
            addRule: dict.admin.policyDetail.config.addRule,
            ruleName: dict.admin.policyDetail.config.ruleName,
            minImdbVotes: dict.admin.policyDetail.config.minImdbVotes,
            minTraktVotes: dict.admin.policyDetail.config.minTraktVotes,
            minQualityScore: dict.admin.policyDetail.config.minQualityScore,
            providers: dict.admin.policyDetail.config.requiredProviders,
            ratings: dict.admin.policyDetail.config.requiredRatings,
            providerPlaceholder: dict.admin.policyDetail.config.providerPlaceholder,
          },
        }}
      />
    </div>
  )
}

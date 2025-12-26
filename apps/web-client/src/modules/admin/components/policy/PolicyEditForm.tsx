"use client"

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Loader2, Save, X } from 'lucide-react'
import type { PolicyConfigDto, BreakoutRule, BlockedCountryMode, EligibilityMode, GlobalRequirements } from '@/core/api/admin'
import type { PolicyFormLabels } from './labels.types'
import {
  CountriesEditor,
  LanguagesEditor,
  ProvidersEditor,
  SettingsEditor,
  BreakoutRulesEditor,
  GlobalRequirementsEditor,
} from './editors'

export interface PolicyFormData {
  allowedCountries: string[]
  blockedCountries: string[]
  blockedCountryMode: BlockedCountryMode
  allowedLanguages: string[]
  blockedLanguages: string[]
  globalProviders: string[]
  breakoutRules: BreakoutRule[]
  eligibilityMode: EligibilityMode
  homepage: { minRelevanceScore: number }
  globalRequirements?: GlobalRequirements
}

// Type-safe field keys
const FORM_FIELDS = {
  allowedCountries: 'allowedCountries',
  blockedCountries: 'blockedCountries',
  blockedCountryMode: 'blockedCountryMode',
  allowedLanguages: 'allowedLanguages',
  blockedLanguages: 'blockedLanguages',
  globalProviders: 'globalProviders',
  breakoutRules: 'breakoutRules',
  eligibilityMode: 'eligibilityMode',
  homepage: 'homepage',
  globalRequirements: 'globalRequirements',
} as const satisfies Record<keyof PolicyFormData, keyof PolicyFormData>

interface PolicyEditFormProps {
  initialConfig: PolicyConfigDto
  onSave: (data: PolicyFormData) => Promise<void>
  onCancel: () => void
  isSaving?: boolean
  showActions?: boolean
  labels?: PolicyFormLabels
}

/**
 * Form for editing policy configuration.
 * 
 * Manages form state and provides save/cancel actions.
 * Creates a new policy version on save.
 */
export function PolicyEditForm({
  initialConfig,
  onSave,
  onCancel,
  isSaving = false,
  showActions = true,
  labels,
}: PolicyEditFormProps) {
  const [formData, setFormData] = useState<PolicyFormData>({
    allowedCountries: initialConfig.allowedCountries,
    blockedCountries: initialConfig.blockedCountries,
    blockedCountryMode: initialConfig.blockedCountryMode,
    allowedLanguages: initialConfig.allowedLanguages,
    blockedLanguages: initialConfig.blockedLanguages,
    globalProviders: initialConfig.globalProviders,
    breakoutRules: initialConfig.breakoutRules,
    eligibilityMode: initialConfig.eligibilityMode,
    homepage: { minRelevanceScore: initialConfig.homepage.minRelevanceScore },
    globalRequirements: initialConfig.globalRequirements,
  })

  const handleSave = async () => {
    await onSave(formData)
  }

  const updateField = <K extends keyof PolicyFormData>(
    field: K,
    value: PolicyFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      {showActions && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            {labels?.cancel ?? 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {labels?.saving ?? 'Saving...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {labels?.save ?? 'Save as New Version'}
              </>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CountriesEditor
          allowedCountries={formData.allowedCountries}
          blockedCountries={formData.blockedCountries}
          onAllowedChange={(v) => updateField(FORM_FIELDS.allowedCountries, v)}
          onBlockedChange={(v) => updateField(FORM_FIELDS.blockedCountries, v)}
          labels={labels?.countries}
        />
        <LanguagesEditor
          allowedLanguages={formData.allowedLanguages}
          blockedLanguages={formData.blockedLanguages}
          onAllowedChange={(v) => updateField(FORM_FIELDS.allowedLanguages, v)}
          onBlockedChange={(v) => updateField(FORM_FIELDS.blockedLanguages, v)}
          labels={labels?.languages}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProvidersEditor
          providers={formData.globalProviders}
          onChange={(v) => updateField(FORM_FIELDS.globalProviders, v)}
          labels={labels?.providers}
        />
        <SettingsEditor
          eligibilityMode={formData.eligibilityMode}
          blockedCountryMode={formData.blockedCountryMode}
          minRelevanceScore={formData.homepage.minRelevanceScore}
          onEligibilityModeChange={(v) => updateField(FORM_FIELDS.eligibilityMode, v)}
          onBlockedCountryModeChange={(v) => updateField(FORM_FIELDS.blockedCountryMode, v)}
          onMinRelevanceScoreChange={(v) =>
            updateField(FORM_FIELDS.homepage, { minRelevanceScore: v })
          }
          labels={labels?.settings}
        />
      </div>

      <GlobalRequirementsEditor
        globalRequirements={formData.globalRequirements}
        onChange={(v) => updateField(FORM_FIELDS.globalRequirements, v)}
        labels={labels?.globalRequirements}
      />

      <BreakoutRulesEditor
        rules={formData.breakoutRules}
        onChange={(v) => updateField(FORM_FIELDS.breakoutRules, v)}
        labels={labels?.breakoutRules}
      />
    </div>
  )
}

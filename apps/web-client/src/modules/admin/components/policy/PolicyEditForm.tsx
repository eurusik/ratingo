"use client"

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Loader2, Save, X } from 'lucide-react'
import type { PolicyConfigDto, BreakoutRule } from '@/core/api/admin'
import {
  CountriesEditor,
  LanguagesEditor,
  ProvidersEditor,
  SettingsEditor,
  BreakoutRulesEditor,
} from './editors'

export interface PolicyFormData {
  allowedCountries: string[]
  blockedCountries: string[]
  blockedCountryMode: 'ANY' | 'MAJORITY'
  allowedLanguages: string[]
  blockedLanguages: string[]
  globalProviders: string[]
  breakoutRules: BreakoutRule[]
  eligibilityMode: 'STRICT' | 'RELAXED'
  homepage: { minRelevanceScore: number }
}

interface PolicyEditFormProps {
  initialConfig: PolicyConfigDto
  onSave: (data: PolicyFormData) => Promise<void>
  onCancel: () => void
  isSaving?: boolean
  labels?: {
    save?: string
    saving?: string
    cancel?: string
    countries?: {
      title?: string
      allowed?: string
      blocked?: string
    }
    languages?: {
      title?: string
      allowed?: string
      blocked?: string
    }
    providers?: {
      title?: string
    }
    settings?: {
      title?: string
      eligibilityMode?: string
      blockedCountryMode?: string
      minRelevanceScore?: string
    }
    breakoutRules?: {
      title?: string
      addRule?: string
      priority?: string
    }
  }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CountriesEditor
          allowedCountries={formData.allowedCountries}
          blockedCountries={formData.blockedCountries}
          onAllowedChange={(v) => updateField('allowedCountries', v)}
          onBlockedChange={(v) => updateField('blockedCountries', v)}
          labels={labels?.countries}
        />
        <LanguagesEditor
          allowedLanguages={formData.allowedLanguages}
          blockedLanguages={formData.blockedLanguages}
          onAllowedChange={(v) => updateField('allowedLanguages', v)}
          onBlockedChange={(v) => updateField('blockedLanguages', v)}
          labels={labels?.languages}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProvidersEditor
          providers={formData.globalProviders}
          onChange={(v) => updateField('globalProviders', v)}
          labels={labels?.providers}
        />
        <SettingsEditor
          eligibilityMode={formData.eligibilityMode}
          blockedCountryMode={formData.blockedCountryMode}
          minRelevanceScore={formData.homepage.minRelevanceScore}
          onEligibilityModeChange={(v) => updateField('eligibilityMode', v)}
          onBlockedCountryModeChange={(v) => updateField('blockedCountryMode', v)}
          onMinRelevanceScoreChange={(v) =>
            updateField('homepage', { minRelevanceScore: v })
          }
          labels={labels?.settings}
        />
      </div>

      <BreakoutRulesEditor
        rules={formData.breakoutRules}
        onChange={(v) => updateField('breakoutRules', v)}
        labels={labels?.breakoutRules}
      />
    </div>
  )
}

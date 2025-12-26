"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Badge } from '@/shared/ui/badge'
import type { PolicyConfigDto } from '@/core/api/admin'
import { POLICY_STATUS } from '@/modules/admin/types'
import {
  CountriesCard,
  LanguagesCard,
  ProvidersCard,
  SettingsCard,
  BreakoutRulesCard,
  type ConfigLabels,
} from './PolicyConfigCards'
import { PolicyEditForm, type PolicyFormData } from './PolicyEditForm'

interface PolicyConfigTabProps {
  config: PolicyConfigDto | undefined
  version: string
  status: string
  isEditing?: boolean
  onSave?: (data: PolicyFormData) => Promise<void>
  onCancelEdit?: () => void
  isSaving?: boolean
  labels: {
    config?: ConfigLabels
    policyInfo: {
      title: string
      version: string
      status: string
    }
    statusLabels: {
      active: string
      inactive: string
    }
    edit?: {
      save?: string
      saving?: string
      cancel?: string
    }
  }
}

/**
 * Displays policy configuration tab with view/edit modes.
 * 
 * Shows config cards (countries, languages, providers, settings, breakout rules)
 * in view mode, or edit form in edit mode.
 *
 * @param config - Policy configuration (optional)
 * @param version - Policy version
 * @param status - Policy status
 * @param isEditing - Whether in edit mode
 * @param onSave - Callback for saving changes
 * @param onCancelEdit - Callback for canceling edit
 * @param isSaving - Whether save is in progress
 * @param labels - Localized labels
 */
export function PolicyConfigTab({
  config,
  version,
  status,
  isEditing = false,
  onSave,
  onCancelEdit,
  isSaving = false,
  labels,
}: PolicyConfigTabProps) {
  if (!config) {
    return <PolicyInfoFallback version={version} status={status} labels={labels} />
  }

  if (isEditing && onSave && onCancelEdit) {
    return (
      <PolicyEditForm
        initialConfig={config}
        onSave={onSave}
        onCancel={onCancelEdit}
        isSaving={isSaving}
        labels={{
          ...labels.edit,
          countries: {
            title: labels.config?.countries,
            allowed: labels.config?.allowed,
            blocked: labels.config?.blocked,
          },
          languages: {
            title: labels.config?.languages,
            allowed: labels.config?.allowed,
            blocked: labels.config?.blocked,
          },
          providers: {
            title: labels.config?.providers,
          },
          settings: {
            title: labels.config?.settings,
            eligibilityMode: labels.config?.eligibilityMode,
            blockedCountryMode: labels.config?.blockedCountryMode,
            minRelevanceScore: labels.config?.minRelevanceScore,
          },
          breakoutRules: {
            title: labels.config?.breakoutRules,
            priority: labels.config?.priority,
            addRule: labels.config?.addRule,
          },
        }}
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CountriesCard config={config} labels={labels.config} />
        <LanguagesCard config={config} labels={labels.config} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProvidersCard config={config} labels={labels.config} />
        <SettingsCard config={config} labels={labels.config} />
      </div>
      <BreakoutRulesCard config={config} labels={labels.config} />
    </>
  )
}

function PolicyInfoFallback({
  version,
  status,
  labels,
}: {
  version: string
  status: string
  labels: PolicyConfigTabProps['labels']
}) {
  const badgeVariant = status === POLICY_STATUS.ACTIVE ? 'default' : 'secondary'
  const statusLabel = status === POLICY_STATUS.ACTIVE ? labels.statusLabels.active : labels.statusLabels.inactive

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.policyInfo.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium">{labels.policyInfo.version}</h4>
            <p className="text-sm text-muted-foreground">{version}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">{labels.policyInfo.status}</h4>
            <Badge variant={badgeVariant} className="mt-1">
              {statusLabel}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

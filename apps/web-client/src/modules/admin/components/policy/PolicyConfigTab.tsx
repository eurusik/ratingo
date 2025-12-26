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

interface PolicyConfigTabProps {
  config: PolicyConfigDto | undefined
  version: string
  status: string
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
  }
}

export function PolicyConfigTab({ config, version, status, labels }: PolicyConfigTabProps) {
  if (!config) {
    return <PolicyInfoFallback version={version} status={status} labels={labels} />
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

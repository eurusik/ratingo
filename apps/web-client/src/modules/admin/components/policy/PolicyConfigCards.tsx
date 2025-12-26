"use client"

import { Globe, Languages, Tv, Settings, Shield } from 'lucide-react'
import type { PolicyConfigDto } from '@/core/api/admin'
import { ConfigCard } from './ConfigCard'
import { AllowedBlockedList } from './AllowedBlockedList'
import { BadgeList } from './BadgeList'
import { SettingRow } from './SettingRow'
import { BreakoutRuleItem } from './BreakoutRuleItem'

export interface ConfigLabels {
  countries?: string
  languages?: string
  allowed?: string
  blocked?: string
  blockedCountryMode?: string
  providers?: string
  settings?: string
  eligibilityMode?: string
  minRelevanceScore?: string
  breakoutRules?: string
  priority?: string
}

interface PolicyConfigCardsProps {
  config: PolicyConfigDto
  labels?: ConfigLabels
}

export function CountriesCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.countries ?? 'Countries'} icon={Globe} contentClassName="space-y-3">
      <AllowedBlockedList
        allowed={config.allowedCountries}
        blocked={config.blockedCountries}
        labels={{
          allowed: labels?.allowed ?? 'Allowed',
          blocked: labels?.blocked ?? 'Blocked',
        }}
      />
    </ConfigCard>
  )
}

export function LanguagesCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.languages ?? 'Languages'} icon={Languages} contentClassName="space-y-3">
      <AllowedBlockedList
        allowed={config.allowedLanguages}
        blocked={config.blockedLanguages}
        labels={{
          allowed: labels?.allowed ?? 'Allowed',
          blocked: labels?.blocked ?? 'Blocked',
        }}
      />
    </ConfigCard>
  )
}

export function ProvidersCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.providers ?? 'Global Providers'} icon={Tv}>
      <BadgeList items={config.globalProviders} />
    </ConfigCard>
  )
}

export function SettingsCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.settings ?? 'Settings'} icon={Settings} contentClassName="space-y-2">
      <SettingRow
        label={labels?.eligibilityMode ?? 'Eligibility Mode'}
        value={config.eligibilityMode}
        variant={config.eligibilityMode === 'STRICT' ? 'default' : 'secondary'}
      />
      <SettingRow
        label={labels?.blockedCountryMode ?? 'Blocked Country Mode'}
        value={config.blockedCountryMode}
      />
      <SettingRow
        label={labels?.minRelevanceScore ?? 'Min Relevance Score'}
        value={config.homepage.minRelevanceScore}
        variant="outline"
      />
    </ConfigCard>
  )
}

export function BreakoutRulesCard({ config, labels }: PolicyConfigCardsProps) {
  if (config.breakoutRules.length === 0) return null

  const title = `${labels?.breakoutRules ?? 'Breakout Rules'} (${config.breakoutRules.length})`

  return (
    <ConfigCard title={title} icon={Shield}>
      <div className="space-y-3">
        {config.breakoutRules.map((rule) => (
          <BreakoutRuleItem key={rule.id} rule={rule} priorityLabel={labels?.priority} />
        ))}
      </div>
    </ConfigCard>
  )
}

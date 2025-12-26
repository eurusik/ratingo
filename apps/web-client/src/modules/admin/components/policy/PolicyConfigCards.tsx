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
  countriesDescription?: string
  languages?: string
  languagesDescription?: string
  allowed?: string
  blocked?: string
  allowedCountryPlaceholder?: string
  blockedCountryPlaceholder?: string
  allowedLanguagePlaceholder?: string
  blockedLanguagePlaceholder?: string
  othersExcluded?: string
  othersLanguagesExcluded?: string
  excludedFromCatalog?: string
  blockedCountryMode?: string
  blockedCountryModeHint?: string
  anyLabel?: string
  anyDescription?: string
  majorityLabel?: string
  majorityDescription?: string
  providers?: string
  providersDescription?: string
  providersPlaceholder?: string
  providersSearchPlaceholder?: string
  providersEmptyText?: string
  settings?: string
  settingsDescription?: string
  eligibilityMode?: string
  eligibilityModeHint?: string
  strictLabel?: string
  strictDescription?: string
  relaxedLabel?: string
  relaxedDescription?: string
  minRelevanceScore?: string
  minRelevanceScoreHint?: string
  breakoutRules?: string
  breakoutRulesDescription?: string
  priority?: string
  addRule?: string
  ruleName?: string
  minImdbVotes?: string
  minTraktVotes?: string
  minQualityScore?: string
  requiredProviders?: string
  requiredRatings?: string
  providerPlaceholder?: string
}

interface PolicyConfigCardsProps {
  config: PolicyConfigDto
  labels?: ConfigLabels
}

/**
 * Displays policy countries configuration card.
 * 
 * Shows allowed and blocked countries with ISO codes.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
export function CountriesCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.countries ?? 'Countries'} icon={Globe} contentClassName="space-y-3">
      <AllowedBlockedList
        allowed={config.allowedCountries}
        blocked={config.blockedCountries}
        labels={{
          allowed: labels?.allowed ?? 'Allowed',
          blocked: labels?.blocked ?? 'Blocked',
          othersExcluded: labels?.othersExcluded ?? 'Other countries',
          excludedFromCatalog: labels?.excludedFromCatalog ?? 'Excluded from catalog',
        }}
      />
    </ConfigCard>
  )
}

/**
 * Displays policy languages configuration card.
 * 
 * Shows allowed and blocked languages with ISO codes.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
export function LanguagesCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.languages ?? 'Languages'} icon={Languages} contentClassName="space-y-3">
      <AllowedBlockedList
        allowed={config.allowedLanguages}
        blocked={config.blockedLanguages}
        labels={{
          allowed: labels?.allowed ?? 'Allowed',
          blocked: labels?.blocked ?? 'Blocked',
          othersExcluded: labels?.othersLanguagesExcluded ?? 'Other languages',
          excludedFromCatalog: labels?.excludedFromCatalog ?? 'Excluded from catalog',
        }}
      />
    </ConfigCard>
  )
}

/**
 * Displays global streaming providers card.
 * 
 * Shows list of provider names as badges.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
export function ProvidersCard({ config, labels }: PolicyConfigCardsProps) {
  return (
    <ConfigCard title={labels?.providers ?? 'Global Providers'} icon={Tv}>
      <BadgeList items={config.globalProviders} />
    </ConfigCard>
  )
}

/**
 * Displays policy settings card.
 * 
 * Shows eligibility mode, blocked country mode, and min relevance score.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
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

/**
 * Displays breakout rules card.
 * 
 * Shows list of exception rules with requirements.
 * Returns null if no rules configured.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
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

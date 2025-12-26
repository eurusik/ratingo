"use client"

import { Globe, Languages, Tv, Settings, Shield, Filter } from 'lucide-react'
import type { PolicyConfigDto } from '@/core/api/admin'
import type { ConfigViewLabels } from './labels.types'
import { ConfigCard } from './ConfigCard'
import { AllowedBlockedList } from './AllowedBlockedList'
import { BadgeList } from './BadgeList'
import { SettingRow } from './SettingRow'
import { BreakoutRuleItem } from './BreakoutRuleItem'

interface PolicyConfigCardsProps {
  config: PolicyConfigDto
  labels?: ConfigViewLabels
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

/**
 * Displays global quality gate requirements card.
 * 
 * Shows minimum thresholds for quality score, required ratings,
 * and minimum votes from any source.
 * Returns null if no global requirements configured.
 *
 * @param config - Policy configuration
 * @param labels - Localized labels
 */
export function GlobalRequirementsCard({ config, labels }: PolicyConfigCardsProps) {
  const req = config.globalRequirements
  if (!req) return null

  const hasAnyRequirement = 
    (req.minQualityScoreNormalized && req.minQualityScoreNormalized > 0) ||
    (req.requireAnyOfRatingsPresent && req.requireAnyOfRatingsPresent.length > 0) ||
    (req.minVotesAnyOf && req.minVotesAnyOf.min > 0)

  if (!hasAnyRequirement) return null

  return (
    <ConfigCard 
      title={labels?.globalRequirements ?? 'Global Quality Gate'} 
      icon={Filter}
      contentClassName="space-y-2"
    >
      {req.minQualityScoreNormalized && req.minQualityScoreNormalized > 0 && (
        <SettingRow
          label={labels?.minQualityScore ?? 'Min Quality Score'}
          value={req.minQualityScoreNormalized}
          variant="outline"
        />
      )}
      {req.minVotesAnyOf && req.minVotesAnyOf.min > 0 && (
        <div className="pt-1">
          <p className="text-sm text-muted-foreground mb-1">
            {labels?.minVotesAnyOf ?? 'Min Votes (Any Source)'}
          </p>
          <div className="flex items-center gap-2">
            <BadgeList items={req.minVotesAnyOf.sources.map(s => s.toUpperCase())} />
            <span className="text-sm">≥ {req.minVotesAnyOf.min.toLocaleString()}</span>
          </div>
        </div>
      )}
      {req.requireAnyOfRatingsPresent && req.requireAnyOfRatingsPresent.length > 0 && (
        <div className="pt-1">
          <p className="text-sm text-muted-foreground mb-1">
            {labels?.requireRatings ?? 'Required Ratings (any of)'}
          </p>
          <BadgeList items={req.requireAnyOfRatingsPresent} />
        </div>
      )}
    </ConfigCard>
  )
}

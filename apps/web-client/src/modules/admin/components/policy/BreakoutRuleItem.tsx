"use client"

import { Badge } from '@/shared/ui/badge'
import type { BreakoutRule } from '@/core/api/admin'

interface BreakoutRuleItemProps {
  rule: BreakoutRule
  priorityLabel?: string
}

/**
 * Single breakout rule display
 */
export function BreakoutRuleItem({ rule, priorityLabel }: BreakoutRuleItemProps) {
  const { requirements } = rule

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{rule.name}</span>
        <Badge variant="outline" className="text-xs">
          {priorityLabel ?? 'Priority'}: {rule.priority}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {requirements.minImdbVotes && (
          <span>IMDb votes ≥ {requirements.minImdbVotes.toLocaleString()}</span>
        )}
        {requirements.minTraktVotes && (
          <span>Trakt votes ≥ {requirements.minTraktVotes.toLocaleString()}</span>
        )}
        {requirements.minQualityScoreNormalized && (
          <span>Quality ≥ {(requirements.minQualityScoreNormalized * 100).toFixed(0)}%</span>
        )}
        {requirements.requireAnyOfProviders && requirements.requireAnyOfProviders.length > 0 && (
          <span>Providers: {requirements.requireAnyOfProviders.join(', ')}</span>
        )}
        {requirements.requireAnyOfRatingsPresent && requirements.requireAnyOfRatingsPresent.length > 0 && (
          <span>Ratings: {requirements.requireAnyOfRatingsPresent.join(', ')}</span>
        )}
      </div>
    </div>
  )
}

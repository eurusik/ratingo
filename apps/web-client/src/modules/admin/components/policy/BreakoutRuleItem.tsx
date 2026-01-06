'use client';

import { Badge } from '@/shared/ui/badge';
import type { BreakoutRuleDto } from '@/core/api/admin';

interface BreakoutRuleItemProps {
  rule: BreakoutRuleDto;
  priorityLabel?: string;
  /** Resolves provider IDs to display names. */
  resolveProviderNames?: (ids: string[]) => string[];
}

/**
 * Displays single breakout rule with requirements.
 *
 * Shows rule name, priority badge, and formatted requirements
 * (votes, quality score, providers, ratings).
 *
 * @param rule - Breakout rule configuration
 * @param priorityLabel - Localized label for priority
 * @param resolveProviderNames - Function to resolve provider IDs to names
 */
export function BreakoutRuleItem({
  rule,
  priorityLabel,
  resolveProviderNames,
}: BreakoutRuleItemProps) {
  const { requirements } = rule;

  const providerIds = requirements.requireAnyOfProviders ?? [];
  const providerNames = resolveProviderNames
    ? resolveProviderNames(providerIds)
    : providerIds;

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
        {providerNames.length > 0 && <span>Providers: {providerNames.join(', ')}</span>}
        {requirements.requireAnyOfRatingsPresent &&
          requirements.requireAnyOfRatingsPresent.length > 0 && (
            <span>Ratings: {requirements.requireAnyOfRatingsPresent.join(', ')}</span>
          )}
        {requirements.originCountries && requirements.originCountries.length > 0 && (
          <span>Countries: {requirements.originCountries.join(', ')}</span>
        )}
      </div>
    </div>
  );
}

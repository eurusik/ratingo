/**
 * Label types for policy form components.
 * 
 * These types match the JSON structure in locales/[lang].json
 * under admin.policyDetail.form
 */

export interface CountriesLabels {
  title?: string
  description?: string
  allowed?: string
  blocked?: string
  allowedPlaceholder?: string
  blockedPlaceholder?: string
}

export interface LanguagesLabels {
  title?: string
  description?: string
  allowed?: string
  blocked?: string
  allowedPlaceholder?: string
  blockedPlaceholder?: string
}

export interface ProvidersLabels {
  title?: string
  description?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}

export interface SettingsLabels {
  title?: string
  description?: string
  eligibilityMode?: string
  eligibilityModeHint?: string
  strictLabel?: string
  strictDescription?: string
  relaxedLabel?: string
  relaxedDescription?: string
  blockedCountryMode?: string
  blockedCountryModeHint?: string
  anyLabel?: string
  anyDescription?: string
  majorityLabel?: string
  majorityDescription?: string
  minRelevanceScore?: string
  minRelevanceScoreHint?: string
}

export interface BreakoutRulesLabels {
  title?: string
  description?: string
  addRule?: string
  priority?: string
  ruleName?: string
  minImdbVotes?: string
  minTraktVotes?: string
  minQualityScore?: string
  providers?: string
  ratings?: string
  providerPlaceholder?: string
}

export interface GlobalRequirementsLabels {
  title?: string
  description?: string
  minImdbVotes?: string
  minImdbVotesHint?: string
  minTraktVotes?: string
  minTraktVotesHint?: string
  minQualityScore?: string
  minQualityScoreHint?: string
  requireRatings?: string
  requireRatingsHint?: string
  addRating?: string
}

/** Labels for PolicyEditForm - matches admin.policyDetail.form in JSON */
export interface PolicyFormLabels {
  save?: string
  saving?: string
  cancel?: string
  countries?: CountriesLabels
  languages?: LanguagesLabels
  providers?: ProvidersLabels
  settings?: SettingsLabels
  breakoutRules?: BreakoutRulesLabels
  globalRequirements?: GlobalRequirementsLabels
}

/** Labels for view-only config cards */
export interface ConfigViewLabels {
  // Card titles
  countries?: string
  languages?: string
  providers?: string
  settings?: string
  breakoutRules?: string
  // Shared labels
  allowed?: string
  blocked?: string
  othersExcluded?: string
  othersLanguagesExcluded?: string
  excludedFromCatalog?: string
  // Settings labels
  eligibilityMode?: string
  blockedCountryMode?: string
  minRelevanceScore?: string
  priority?: string
}

/** Labels for policy info section */
export interface PolicyInfoLabels {
  title: string
  version: string
  status: string
}

/** Labels for status badges */
export interface StatusLabels {
  active: string
  inactive: string
}

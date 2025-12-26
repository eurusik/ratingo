"use client"

import { useState } from 'react'
import { Shield, Plus, Trash2, GripVertical } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import type { BreakoutRule } from '@/core/api/admin'
import { TagInput } from './TagInput'

interface BreakoutRulesEditorProps {
  rules: BreakoutRule[]
  onChange: (rules: BreakoutRule[]) => void
  labels?: {
    title?: string
    addRule?: string
    ruleName?: string
    priority?: string
    minImdbVotes?: string
    minTraktVotes?: string
    minQualityScore?: string
    providers?: string
    ratings?: string
  }
}

const RATING_OPTIONS = ['imdb', 'metacritic', 'rt', 'trakt'] as const

/**
 * Editor for breakout rules (exceptions to main policy).
 */
export function BreakoutRulesEditor({
  rules,
  onChange,
  labels,
}: BreakoutRulesEditorProps) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const addRule = () => {
    const newRule: BreakoutRule = {
      id: `rule-${Date.now()}`,
      name: `Rule ${rules.length + 1}`,
      priority: rules.length + 1,
      requirements: {},
    }
    onChange([...rules, newRule])
    setExpandedRule(newRule.id)
  }

  const removeRule = (ruleId: string) => {
    onChange(rules.filter((r) => r.id !== ruleId))
  }

  const updateRule = (ruleId: string, updates: Partial<BreakoutRule>) => {
    onChange(
      rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    )
  }

  const updateRequirements = (
    ruleId: string,
    reqUpdates: Partial<BreakoutRule['requirements']>
  ) => {
    onChange(
      rules.map((r) =>
        r.id === ruleId
          ? { ...r, requirements: { ...r.requirements, ...reqUpdates } }
          : r
      )
    )
  }

  const title = `${labels?.title ?? 'Breakout Rules'} (${rules.length})`

  return (
    <ConfigCard title={title} icon={Shield}>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="border rounded-lg">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{rule.name}</span>
                <Badge variant="outline" className="text-xs">
                  {labels?.priority ?? 'Priority'}: {rule.priority}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  removeRule(rule.id)
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {expandedRule === rule.id && (
              <div className="p-3 pt-0 space-y-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{labels?.ruleName ?? 'Rule Name'}</Label>
                    <Input
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{labels?.priority ?? 'Priority'}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={rule.priority}
                      onChange={(e) => updateRule(rule.id, { priority: Number(e.target.value) })}
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{labels?.minImdbVotes ?? 'Min IMDb Votes'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={rule.requirements.minImdbVotes ?? ''}
                      onChange={(e) =>
                        updateRequirements(rule.id, {
                          minImdbVotes: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder="e.g., 10000"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{labels?.minTraktVotes ?? 'Min Trakt Votes'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={rule.requirements.minTraktVotes ?? ''}
                      onChange={(e) =>
                        updateRequirements(rule.id, {
                          minTraktVotes: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder="e.g., 1000"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{labels?.minQualityScore ?? 'Min Quality %'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        rule.requirements.minQualityScoreNormalized
                          ? rule.requirements.minQualityScoreNormalized * 100
                          : ''
                      }
                      onChange={(e) =>
                        updateRequirements(rule.id, {
                          minQualityScoreNormalized: e.target.value
                            ? Number(e.target.value) / 100
                            : undefined,
                        })
                      }
                      placeholder="e.g., 70"
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{labels?.providers ?? 'Required Providers (any of)'}</Label>
                  <TagInput
                    value={rule.requirements.requireAnyOfProviders ?? []}
                    onChange={(providers) =>
                      updateRequirements(rule.id, { requireAnyOfProviders: providers })
                    }
                    placeholder="Add provider (e.g., netflix)"
                    transform={(v) => v.toLowerCase()}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{labels?.ratings ?? 'Required Ratings (any of)'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {RATING_OPTIONS.map((rating) => {
                      const isSelected = rule.requirements.requireAnyOfRatingsPresent?.includes(rating)
                      return (
                        <Badge
                          key={rating}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = rule.requirements.requireAnyOfRatingsPresent ?? []
                            const updated = isSelected
                              ? current.filter((r) => r !== rating)
                              : [...current, rating]
                            updateRequirements(rule.id, {
                              requireAnyOfRatingsPresent: updated.length > 0 ? updated : undefined,
                            })
                          }}
                        >
                          {rating}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addRule} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {labels?.addRule ?? 'Add Rule'}
        </Button>
      </div>
    </ConfigCard>
  )
}

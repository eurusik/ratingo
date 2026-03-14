'use client';

import { useState, useMemo } from 'react';
import { Star, Bookmark, AlertCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import type { ParsedItem } from '../../utils/csv-parsers';
import { formatNumber } from '../../utils/format-number';

const MAX_PREVIEW = 20;

function samplePreview(ratings: ParsedItem[], watchlist: ParsedItem[], max = MAX_PREVIEW): ParsedItem[] {
  if (ratings.length + watchlist.length <= max) return [...ratings, ...watchlist];
  const total = ratings.length + watchlist.length;
  const rCount = ratings.length === 0 ? 0 : Math.max(1, Math.round((ratings.length / total) * max));
  const wCount = watchlist.length === 0 ? 0 : Math.min(max - rCount, watchlist.length);
  return [
    ...ratings.slice(0, Math.min(rCount, ratings.length)),
    ...watchlist.slice(0, Math.min(wCount, watchlist.length)),
  ];
}

interface ImportPreviewTableProps {
  ratings: ParsedItem[];
  watchlist: ParsedItem[];
  filter: string;
  onFilterChange: (value: string) => void;
  ratingsSkippedCount: number;
  watchlistSkippedCount: number;
  labels: {
    summary: string;
    truncated: string;
    rating: string;
    watchlist: string;
    colTitle: string;
    colYear: string;
    colType: string;
    colRating: string;
    filterAll: string;
    filterRatings: string;
    filterWatchlist: string;
    skippedExplanation: string;
  };
}

interface PreviewRowsProps {
  items: ParsedItem[];
  maxPreview: number;
  ratingLabel: string;
  watchlistLabel: string;
  truncatedLabel: string;
  colTitleLabel: string;
  colYearLabel: string;
  colTypeLabel: string;
  colRatingLabel: string;
}

function PreviewRows({
  items,
  maxPreview,
  ratingLabel,
  watchlistLabel,
  truncatedLabel,
  colTitleLabel,
  colYearLabel,
  colTypeLabel,
  colRatingLabel,
}: PreviewRowsProps) {
  const preview = items.slice(0, maxPreview);
  const remaining = items.length - maxPreview;

  return (
    <div className="rounded-md border border-cinema-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-cinema-border hover:bg-transparent">
            <TableHead className="text-cinema-text-muted">{colTitleLabel}</TableHead>
            <TableHead className="text-cinema-text-muted w-16">{colYearLabel}</TableHead>
            <TableHead className="text-cinema-text-muted w-24">{colTypeLabel}</TableHead>
            <TableHead className="text-cinema-text-muted text-right w-20 tabular-nums">
              {colRatingLabel}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.map((item, idx) => (
            <TableRow key={`${item.imdbId ?? ''}${item.tmdbId ?? ''}-${idx}`} className="border-cinema-borderSoft hover:bg-cinema-elevated/30">
              <TableCell className="text-cinema-text-primary font-medium max-w-[180px] truncate">
                {item.title ?? '—'}
              </TableCell>
              <TableCell className="text-cinema-text-muted text-sm">
                {item.year ?? '—'}
              </TableCell>
              <TableCell>
                {item.state === 'completed' ? (
                  <Badge variant="outline" className="text-xs">
                    <Star className="w-3 h-3 mr-1 inline text-amber-400" />
                    {ratingLabel}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <Bookmark className="w-3 h-3 mr-1 inline text-cinema-text-muted" />
                    {watchlistLabel}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right text-cinema-text-muted text-sm tabular-nums">
                {item.rating != null ? item.rating : '—'}
              </TableCell>
            </TableRow>
          ))}

          {remaining > 0 && (
            <TableRow className="border-cinema-borderSoft">
              <TableCell colSpan={4} className="text-center text-cinema-text-muted text-sm py-2">
                {truncatedLabel.replace('{count}', formatNumber(remaining))}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function ImportPreviewTable({
  ratings,
  watchlist,
  filter,
  onFilterChange,
  ratingsSkippedCount,
  watchlistSkippedCount,
  labels,
}: ImportPreviewTableProps) {
  const [skippedOpen, setSkippedOpen] = useState(false);
  const totalCount = ratings.length + watchlist.length;
  const totalSkipped = ratingsSkippedCount + watchlistSkippedCount;

  const summary = labels.summary
    .replace('{ratings}', formatNumber(ratings.length))
    .replace('{watchlist}', formatNumber(watchlist.length));

  const sampledAll = useMemo(() => samplePreview(ratings, watchlist), [ratings, watchlist]);

  const sharedProps = {
    maxPreview: MAX_PREVIEW,
    ratingLabel: labels.rating,
    watchlistLabel: labels.watchlist,
    truncatedLabel: labels.truncated,
    colTitleLabel: labels.colTitle,
    colYearLabel: labels.colYear,
    colTypeLabel: labels.colType,
    colRatingLabel: labels.colRating,
  };

  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm text-cinema-text-muted">{summary}</p>

      <Tabs value={filter} onValueChange={onFilterChange}>
        <TabsList>
          <TabsTrigger value="all">
            {labels.filterAll} ({formatNumber(totalCount)})
          </TabsTrigger>
          <TabsTrigger value="ratings">
            {labels.filterRatings} ({formatNumber(ratings.length)})
          </TabsTrigger>
          <TabsTrigger value="watchlist">
            {labels.filterWatchlist} ({formatNumber(watchlist.length)})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <PreviewRows items={sampledAll} {...sharedProps} />
        </TabsContent>
        <TabsContent value="ratings">
          <PreviewRows items={ratings} {...sharedProps} />
        </TabsContent>
        <TabsContent value="watchlist">
          <PreviewRows items={watchlist} {...sharedProps} />
        </TabsContent>
      </Tabs>

      {totalSkipped > 0 && (
        <Collapsible open={skippedOpen} onOpenChange={setSkippedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 motion-safe:transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{labels.skippedExplanation.replace('{count}', String(totalSkipped))}</span>
              <ChevronDown
                className={`w-3 h-3 motion-safe:transition-transform ${skippedOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-md border border-cinema-borderSoft bg-cinema-card p-3 text-sm text-cinema-text-muted space-y-1">
              {ratingsSkippedCount > 0 && (
                <p>
                  {labels.filterRatings}: {ratingsSkippedCount}
                </p>
              )}
              {watchlistSkippedCount > 0 && (
                <p>
                  {labels.filterWatchlist}: {watchlistSkippedCount}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

'use client';

import { Film, Clapperboard, Database, Aperture } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils/index';

export type ImportSource = 'kinobaza' | 'imdb' | 'tmdb' | 'letterboxd';

interface ImportSourceStepProps {
  onSelect: (source: ImportSource) => void;
  labels: {
    heading: string;
    comingSoon: string;
    sources: Record<ImportSource, { name: string; desc: string }>;
  };
}

interface SourceConfig {
  id: ImportSource;
  icon: React.ElementType;
  available: boolean;
}

const SOURCE_CONFIGS: SourceConfig[] = [
  { id: 'kinobaza', icon: Film, available: true },
  { id: 'imdb', icon: Clapperboard, available: true },
  { id: 'tmdb', icon: Database, available: false },
  { id: 'letterboxd', icon: Aperture, available: false },
];

export function ImportSourceStep({ onSelect, labels }: ImportSourceStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-cinema-text-primary">{labels.heading}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 gap-3">
        {SOURCE_CONFIGS.map(({ id, icon: Icon, available }) => {
          const sourceLabel = labels.sources[id];

          if (available) {
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className="text-left w-full h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cinema-page touch-action-manipulation"
              >
                <Card
                  className={cn(
                    'h-full motion-safe:transition-colors',
                    'hover:border-primary/50 hover:bg-cinema-elevated/50 cursor-pointer',
                  )}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="bg-cinema-elevated rounded-lg p-2.5 shrink-0">
                      <Icon className="h-5 w-5 text-cinema-text-primary" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-cinema-text-primary">{sourceLabel.name}</CardTitle>
                      <p className="text-sm text-cinema-text-muted mt-0.5 line-clamp-2">{sourceLabel.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          }

          return (
            <div
              key={id}
              aria-disabled="true"
              tabIndex={-1}
              className="relative h-full opacity-50 cursor-not-allowed"
            >
              <Card className="h-full">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="bg-cinema-elevated rounded-lg p-2.5 shrink-0">
                    <Icon className="h-5 w-5 text-cinema-text-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-cinema-text-primary">{sourceLabel.name}</CardTitle>
                    <p className="text-sm text-cinema-text-muted mt-0.5">{sourceLabel.desc}</p>
                  </div>
                </CardContent>
              </Card>
              <Badge
                variant="secondary"
                className="absolute top-2 right-2"
              >
                {labels.comingSoon}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

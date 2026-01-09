/**
 * Site footer with project info, data sources, and openness.
 */

import Link from 'next/link';
import { type Route } from 'next';
import { getDictionary } from '@/shared/i18n';

const EXTERNAL_LINKS = {
  github: 'https://github.com/eurusik/ratingo',
  author: 'https://eurusik.tech/',
} as const;

export function Footer() {
  const dict = getDictionary('uk');

  return (
    <footer className="border-t border-border/40 bg-background/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center md:text-left">
          {/* About — anchor column */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">{dict.footer.about}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {dict.footer.descriptionStart}
              <a
                href={EXTERNAL_LINKS.author}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                {dict.footer.authorName}
              </a>
              .
            </p>
            <Link
              href={'/about' as Route}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {dict.footer.aboutLink}
            </Link>
          </div>

          {/* Data Sources — trust signal */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">{dict.footer.sources}</h3>
            <p className="text-sm text-muted-foreground">{dict.footer.sourcesDesc}</p>
          </div>

          {/* Openness */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">{dict.footer.openness}</h3>
            <a
              href={EXTERNAL_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center">{dict.footer.madeIn}</p>
        </div>
      </div>
    </footer>
  );
}

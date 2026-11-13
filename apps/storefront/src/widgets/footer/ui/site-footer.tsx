import type { ReactNode } from 'react';
import Link from 'next/link';
import { ABOUT_ROUTE, EXTERNAL_LINKS, JOURNAL_ROUTE } from '@/shared/config';
import type { Dictionary } from '@/shared/i18n';
import { Container } from '@/shared/ui';

const LINK_CLASS =
  'text-sm text-muted no-underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus';

function ExternalLink({
  href,
  newTabCue,
  children,
}: {
  href: string;
  newTabCue: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
      <span className="sr-only">{` ${newTabCue}`}</span>
    </a>
  );
}

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-16 hidden border-t border-separator md:block">
      <Container className="flex flex-col gap-6 py-10">
        <div className="flex items-start justify-between gap-12">
          <div className="flex max-w-md flex-col gap-2">
            <span translate="no" className="text-lg font-extrabold tracking-tight">
              Ratingo
            </span>
            <p className="text-sm text-muted">{dict.footer.description}</p>
            <p className="text-sm text-muted">{dict.footer.sources}</p>
          </div>
          <nav aria-label={dict.footer.label}>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href={ABOUT_ROUTE} className={LINK_CLASS}>
                  {dict.footer.about}
                </Link>
              </li>
              <li>
                <Link href={JOURNAL_ROUTE} className={LINK_CLASS}>
                  {dict.footer.journal}
                </Link>
              </li>
              <li>
                <ExternalLink href={EXTERNAL_LINKS.github} newTabCue={dict.common.opensInNewTab}>
                  {dict.footer.github}
                </ExternalLink>
              </li>
            </ul>
          </nav>
        </div>
        <div className="flex items-center justify-between border-t border-separator pt-4 text-xs text-muted">
          <span>{dict.footer.madeIn}</span>
          <ExternalLink href={EXTERNAL_LINKS.author} newTabCue={dict.common.opensInNewTab}>
            {dict.footer.authorName}
          </ExternalLink>
        </div>
      </Container>
    </footer>
  );
}

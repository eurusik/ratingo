import { Link } from '@heroui/react';
import { ABOUT_ROUTE, EXTERNAL_LINKS, JOURNAL_ROUTE } from '@/shared/config';
import type { Dictionary } from '@/shared/i18n';

const LINK_CLASS = 'text-sm text-muted no-underline hover:text-foreground';

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-16 hidden border-t border-separator md:block">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-10">
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
                <Link
                  href={EXTERNAL_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  {dict.footer.github}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="flex items-center justify-between border-t border-separator pt-4 text-xs text-muted">
          <span>{dict.footer.madeIn}</span>
          <Link
            href={EXTERNAL_LINKS.author}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {dict.footer.authorName}
          </Link>
        </div>
      </div>
    </footer>
  );
}

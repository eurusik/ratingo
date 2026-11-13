import { Kbd } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

export function KeyboardHints() {
  const { dict } = useTranslation();

  return (
    <dl
      aria-label={dict.search.hints.label}
      className="hidden items-center gap-4 border-t border-separator pt-3 text-xs text-muted md:mt-auto md:flex"
    >
      <div className="flex items-center gap-1.5">
        <dt className="flex gap-1">
          <Kbd>
            <Kbd.Abbr keyValue="up" />
          </Kbd>
          <Kbd>
            <Kbd.Abbr keyValue="down" />
          </Kbd>
        </dt>
        <dd>{dict.search.hints.navigate}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>
          <Kbd>
            <Kbd.Abbr keyValue="enter" />
          </Kbd>
        </dt>
        <dd>{dict.search.hints.open}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>
          <Kbd>
            <Kbd.Content>esc</Kbd.Content>
          </Kbd>
        </dt>
        <dd>{dict.search.hints.close}</dd>
      </div>
    </dl>
  );
}

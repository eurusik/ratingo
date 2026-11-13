import { ScrollShadow } from '@heroui/react';
import { getDictionary, type Locale } from '@/shared/i18n';
import type { MediaType } from '@/shared/api';
import type { Credits } from '../model/credits';
import { DetailsSection } from './details-section';
import { PersonAvatar } from './person-avatar';

function CrewLine({
  type,
  credits,
  locale,
}: {
  type: MediaType;
  credits: Credits;
  locale: Locale;
}) {
  const dict = getDictionary(locale).details.cast;
  const groups =
    type === 'show'
      ? [{ label: dict.creators, names: credits.creators }]
      : [
          { label: dict.directing, names: credits.directors },
          { label: dict.writing, names: credits.writers },
        ];
  const shown = groups.filter((group) => group.names.length > 0);

  if (shown.length === 0) return null;

  return (
    <p className="mt-1 text-sm text-foreground/85 md:text-[15px]">
      {shown.map((group, index) => (
        <span key={group.label}>
          {index > 0 ? ' · ' : null}
          <span className="text-muted">{group.label}</span> {group.names.join(', ')}
        </span>
      ))}
    </p>
  );
}

interface CastSectionProps {
  type: MediaType;
  credits: Credits;
  locale: Locale;
}

export function CastSection({ type, credits, locale }: CastSectionProps) {
  const title = getDictionary(locale).details.cast.title;

  return (
    <DetailsSection id="details-cast" title={title}>
      {credits.cast.length > 0 ? (
        <ScrollShadow
          orientation="horizontal"
          hideScrollBar
          tabIndex={0}
          aria-label={title}
          className="-mx-4 snap-x scroll-px-4 overscroll-x-contain rounded-xl md:mx-0 md:overflow-visible"
        >
          <ul className="flex w-max gap-3.5 px-4 md:grid md:w-full md:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] md:gap-4 md:px-0">
            {credits.cast.map((member) => (
              <li
                key={member.id}
                className="flex w-21 snap-start flex-col items-center gap-1.5 text-center md:w-auto md:gap-2"
              >
                <PersonAvatar
                  name={member.name}
                  photoUrl={member.photoUrl}
                  className="size-18 text-[22px] font-bold md:size-22 md:text-[26px]"
                />
                <span className="text-[13px] leading-tight font-semibold md:text-sm">
                  {member.name}
                </span>
                {member.character ? (
                  <span className="text-xs leading-tight text-muted md:text-[13px]">
                    {member.character}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </ScrollShadow>
      ) : null}
      <CrewLine type={type} credits={credits} locale={locale} />
    </DetailsSection>
  );
}

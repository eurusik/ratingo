import { useId } from 'react';
import { Avatar, ScrollShadow } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import type { Credits } from '../model/credits';

function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

function CrewLine({ type, credits }: { type: MediaType; credits: Credits }) {
  const { dict } = useTranslation();
  const groups = [
    { label: dict.details.cast.creators, names: type === 'show' ? credits.creators : [] },
    { label: dict.details.cast.directing, names: type === 'movie' ? credits.directors : [] },
    { label: dict.details.cast.writing, names: type === 'movie' ? credits.writers : [] },
  ].filter((group) => group.names.length > 0);

  if (groups.length === 0) return null;

  return (
    <p className="mt-1 text-sm text-foreground/85 md:text-[15px]">
      {groups.map((group, index) => (
        <span key={group.label}>
          {index > 0 ? ' · ' : null}
          <span className="text-muted">{group.label}</span> {group.names.join(', ')}
        </span>
      ))}
    </p>
  );
}

export function CastSection({ type, credits }: { type: MediaType; credits: Credits }) {
  const { dict } = useTranslation();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5 md:gap-3.5">
      <h2 id={headingId} className="text-xl font-extrabold tracking-tight md:text-2xl">
        {dict.details.cast.title}
      </h2>
      {credits.cast.length > 0 ? (
        <ScrollShadow
          orientation="horizontal"
          hideScrollBar
          className="-mx-4 snap-x scroll-px-4 overscroll-x-contain md:mx-0 md:overflow-visible"
        >
          <ul className="flex w-max gap-3.5 px-4 md:grid md:w-full md:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] md:gap-4 md:px-0">
            {credits.cast.map((member) => (
              <li
                key={member.id}
                className="flex w-21 snap-start flex-col items-center gap-1.5 text-center md:w-auto md:gap-2"
              >
                <Avatar className="size-18 text-[22px] font-bold md:size-22 md:text-[26px]">
                  {member.photoUrl ? <Avatar.Image src={member.photoUrl} alt="" /> : null}
                  <Avatar.Fallback>{initialOf(member.name)}</Avatar.Fallback>
                </Avatar>
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
      <CrewLine type={type} credits={credits} />
    </section>
  );
}

import type { RatingSource } from '../model/rating-source';

export function TomatoIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="9.2" r="6" fill="#e5402b" />
      <path
        fill="#3e9c35"
        d="M8 3.6c-.9-1.2-2.4-1.6-3.4-1 1 .1 1.9.7 2.4 1.5-1-.3-2.2 0-2.9.7 1.2-.2 2.4.1 3.2.8.3-.6.5-1.3.7-2z"
      />
      <path
        fill="#4cb044"
        d="M8 3.6c.9-1.2 2.4-1.6 3.4-1-1 .1-1.9.7-2.4 1.5 1-.3 2.2 0 2.9.7-1.2-.2-2.4.1-3.2.8-.3-.6-.5-1.3-.7-2z"
      />
    </svg>
  );
}

function PopcornIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0">
      <circle cx="5" cy="5" r="2.2" fill="#f3e3c3" />
      <circle cx="8" cy="3.8" r="2.4" fill="#f3e3c3" />
      <circle cx="11" cy="5" r="2.2" fill="#f3e3c3" />
      <path fill="#fa320a" d="M2.8 6.5h10.4l-1.5 8.5H4.3z" />
      <path fill="#ffffff" d="M5.9 6.5h1.4l.2 8.5H6.3zM8.7 6.5h1.4l-.4 8.5H8.5z" />
    </svg>
  );
}

function TraktIcon() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-4.5 shrink-0">
      <circle cx="9" cy="9" r="9" fill="#ed1c24" />
      <circle cx="9" cy="9" r="5.6" fill="none" stroke="#ffffff" strokeWidth="1.4" />
      <path
        d="M6.6 8.6l2 2 3.6-3.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImdbBadge() {
  return (
    <span
      aria-hidden
      translate="no"
      className="rounded-sm bg-imdb px-1 py-px text-[11px] leading-tight font-black tracking-tight text-black"
    >
      IMDb
    </span>
  );
}

function MetacriticBadge() {
  return (
    <span
      aria-hidden
      translate="no"
      className="flex size-4.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-metacritic bg-black text-[11px] leading-none font-black text-metacritic"
    >
      m
    </span>
  );
}

export function RatingSourceLogo({ source }: { source: RatingSource }) {
  switch (source) {
    case 'imdb':
      return <ImdbBadge />;
    case 'rtCritics':
      return <TomatoIcon className="size-4" />;
    case 'rtAudience':
      return <PopcornIcon />;
    case 'metacritic':
      return <MetacriticBadge />;
    case 'trakt':
      return <TraktIcon />;
  }
}

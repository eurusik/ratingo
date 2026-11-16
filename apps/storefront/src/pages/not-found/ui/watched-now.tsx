import { PosterTile } from '@/entities/media';
import { getDictionary, type Locale } from '@/shared/i18n';
import { loadWatchedNow } from '../api/load-watched-now';

const PHONE_COUNT = 3;
const HEADING_ID = 'watched-now';

export async function WatchedNow({ locale }: { locale: Locale }) {
  const titles = await loadWatchedNow();
  if (titles.length === 0) return null;

  const dict = getDictionary(locale);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="mt-1.5 flex w-full flex-col gap-2.5 text-start md:mt-3"
    >
      <h2 id={HEADING_ID} className="text-[13px] font-bold text-muted">
        {dict.notFound.watchedNow}
      </h2>
      <ul className="grid grid-cols-3 items-start gap-x-2.5 gap-y-4.5 md:grid-cols-6 md:gap-x-4">
        {titles.map((media, index) => (
          <li
            key={media.mediaItemId}
            className={index < PHONE_COUNT ? 'min-w-0' : 'min-w-0 max-md:hidden'}
          >
            <PosterTile media={media} />
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { CardPoster } from './atoms/CardPoster';
import { Badge } from './atoms/Badge';
import { CardRating } from './atoms/CardRating';
import { ProgressBar } from './atoms/ProgressBar';

interface BaseMediaCardProps {
  id: number;
  title: string;
  posterUrl: string | null;
  rating?: number | null;
  ratingImdb?: number | null;
  watchers?: number | null;
  watchersDelta?: number | null;
  href: string;
  rank?: number;
  trendingScore?: number | null;
}

interface ShowSpecificProps {
  type: 'show';
  nextEpisodeSeason?: number;
  nextEpisodeNumber?: number;
  nextEpisodeAirDate?: string | null;
  latestSeasonEpisodes?: number;
  lastEpisodeNumber?: number;
  releaseDate?: never;
}

interface MovieSpecificProps {
  type: 'movie';
  releaseDate?: string | null;
  nextEpisodeSeason?: never;
  nextEpisodeNumber?: never;
  nextEpisodeAirDate?: never;
  latestSeasonEpisodes?: never;
  lastEpisodeNumber?: never;
}

type UnifiedMediaCardProps = BaseMediaCardProps & (ShowSpecificProps | MovieSpecificProps);

export function Card(props: UnifiedMediaCardProps) {
  const {
    id,
    title,
    posterUrl,
    rating,
    ratingImdb,
    watchers,
    watchersDelta,
    href,
    rank,
    trendingScore,
    type,
  } = props;

  const showProgress =
    type === 'show' &&
    props.latestSeasonEpisodes != null &&
    props.lastEpisodeNumber != null &&
    props.latestSeasonEpisodes > 0;

  const releaseYear =
    type === 'movie' && props.releaseDate ? new Date(props.releaseDate).getFullYear() : null;

  return (
    <Link href={href}>
      <div className="group relative bg-zinc-900/50 backdrop-blur rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20 hover:ring-2 hover:ring-blue-500/50 h-full flex flex-col">
        <CardPoster src={posterUrl} alt={title} type={type}>
          {rank != null && rank <= 3 && (
            <Badge variant="rank" position="top-left">
              №{rank}
            </Badge>
          )}
          {trendingScore != null && trendingScore > 80 && (
            <Badge variant="trending" position="top-right">
              ХІТ
            </Badge>
          )}
        </CardPoster>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-semibold text-white line-clamp-2 mb-2 text-sm group-hover:text-blue-400 transition-colors min-h-[2.5rem] break-words">
            {title}
          </h3>

          <CardRating
            rating={rating}
            ratingImdb={ratingImdb}
            watchers={watchers}
            className="mb-2"
          />

          {/* Spacer to push bottom content down */}
          <div className="flex-1" />

          {type === 'show' && props.nextEpisodeNumber != null && props.nextEpisodeSeason != null ? (
            <div className="mb-2 text-xs text-white">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono">
                  S{props.nextEpisodeSeason}E{props.nextEpisodeNumber}
                </span>
                {props.nextEpisodeAirDate && (
                  <span className="text-gray-300">
                    {new Date(props.nextEpisodeAirDate).toLocaleDateString('uk-UA')}
                  </span>
                )}
              </div>
            </div>
          ) : type === 'movie' && releaseYear ? (
            <div className="mb-2 text-xs text-gray-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{releaseYear}</span>
            </div>
          ) : (
            <div className="mb-2 h-5" />
          )}

          {showProgress ? (
            <ProgressBar
              current={props.lastEpisodeNumber!}
              total={props.latestSeasonEpisodes!}
              className="mb-2"
            />
          ) : (
            <div className="mb-2 h-1.5" />
          )}
        </div>
      </div>
    </Link>
  );
}

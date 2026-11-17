import { MediaType } from '@/common/enums/media-type.enum';
import { type IMediaRepository } from '@/modules/catalog/public';

export async function findMissingMovieTmdbIds(
  mediaRepository: IMediaRepository,
  tmdbIds: number[],
): Promise<number[]> {
  const existingMedia = await mediaRepository.findManyByTmdbIds(tmdbIds, MediaType.MOVIE);
  const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));
  return tmdbIds.filter((id) => !existingTmdbIds.has(id));
}

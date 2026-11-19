export const MOVIE_RELEASE_PORT = Symbol('MOVIE_RELEASE_PORT');

export interface MovieReleaseSchedule {
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  releaseDate: Date | null;
}

export interface IMovieReleasePort {
  findMovieReleaseSchedule(mediaItemId: string): Promise<MovieReleaseSchedule | null>;
}

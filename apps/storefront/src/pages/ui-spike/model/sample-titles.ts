export interface SampleTitle {
  id: string;
  title: string;
  year: number;
  kind: 'movie' | 'show';
  rating: number;
}

export const SAMPLE_TITLES: SampleTitle[] = [
  { id: 'dune-2', title: 'Дюна: Частина друга', year: 2024, kind: 'movie', rating: 8.5 },
  { id: 'shogun', title: 'Сьоґун', year: 2024, kind: 'show', rating: 8.7 },
  { id: 'the-bear', title: 'Ведмідь', year: 2022, kind: 'show', rating: 8.5 },
  { id: 'oppenheimer', title: 'Оппенгеймер', year: 2023, kind: 'movie', rating: 8.3 },
  { id: 'severance', title: 'Розділення', year: 2022, kind: 'show', rating: 8.7 },
  { id: 'anora', title: 'Анора', year: 2024, kind: 'movie', rating: 7.6 },
];

export const [, FEATURED_TITLE] = SAMPLE_TITLES;

export const KIND_LABELS: Record<SampleTitle['kind'], string> = {
  movie: 'Фільм',
  show: 'Серіал',
};

const ratingFormat = new Intl.NumberFormat('uk', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatRating(rating: number): string {
  return ratingFormat.format(rating);
}

export const SPIKE_POSTER_TRANSITION = 'spike-poster';

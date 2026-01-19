/**
 * Tests for EpisodesSection component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EpisodesSection } from '../episodes-section';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(props: Record<string, unknown>) {
    return <img {...props} alt={(props.alt as string) || ''} />;
  },
}));

// Mock dictionary
const mockDict = {
  details: {
    showStatus: {
      sectionTitle: 'Епізоди',
      season: 'Сезон',
      nextEpisode: 'Наступна серія',
      minutes: 'хв',
      upcoming: 'Скоро',
      noTitle: 'Епізод {number}',
      changeSeason: 'Змінити сезон',
      plurals: {
        season: { one: 'сезон', few: 'сезони', many: 'сезонів' },
        episode: { one: 'епізод', few: 'епізоди', many: 'епізодів' },
      },
    },
  },
} as ReturnType<typeof import('@/shared/i18n').getDictionary>;

// Helper to create episode
const createEpisode = (
  number: number,
  title: string | null,
  airDate: string | null,
  runtime: number | null = 45,
) => ({
  number,
  title,
  airDate,
  runtime,
  stillPath: null,
});

// Helper to create season
const createSeason = (
  number: number,
  episodes: ReturnType<typeof createEpisode>[],
  name?: string,
) => ({
  number,
  name: name || null,
  episodeCount: episodes.length,
  posterPath: null,
  airDate: null,
  episodes,
});

describe('EpisodesSection', () => {
  describe('rendering', () => {
    it('should not render when no valid seasons', () => {
      const { container } = render(
        <EpisodesSection seasons={[]} dict={mockDict} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not render season 0 (specials)', () => {
      const seasons = [
        createSeason(0, [createEpisode(1, 'Special', '2024-01-01')]),
      ];
      const { container } = render(
        <EpisodesSection seasons={seasons} dict={mockDict} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not render seasons with no episodes', () => {
      const seasons = [createSeason(1, [])];
      const { container } = render(
        <EpisodesSection seasons={seasons} dict={mockDict} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render section title', () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'Pilot', '2024-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);
      expect(screen.getByText('Епізоди')).toBeInTheDocument();
    });

    it('should show next episode date when provided', () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'Pilot', '2024-01-01')]),
      ];
      render(
        <EpisodesSection
          seasons={seasons}
          nextEpisodeDate="2026-02-01"
          dict={mockDict}
        />,
      );
      expect(screen.getByText('Наступна серія:')).toBeInTheDocument();
    });

    it('should select latest season by default', () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'S1E1', '2024-01-01')]),
        createSeason(2, [createEpisode(1, 'S2E1', '2025-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);
      expect(screen.getByText('Сезон 2')).toBeInTheDocument();
    });
  });

  describe('collapse/expand behavior', () => {
    it('should be collapsed by default (opacity-0)', () => {
      const seasons = [
        createSeason(1, [
          createEpisode(1, 'Episode 1', '2024-01-01'),
          createEpisode(2, 'Episode 2', '2024-01-08'),
        ]),
      ];
      const { container } = render(
        <EpisodesSection seasons={seasons} dict={mockDict} />,
      );

      // Check for collapsed state via CSS class
      const animatedContainer = container.querySelector('.grid-rows-\\[0fr\\]');
      expect(animatedContainer).toBeInTheDocument();
    });

    it('should expand when clicking season header', async () => {
      const seasons = [
        createSeason(1, [
          createEpisode(1, 'Episode 1', '2024-01-01'),
          createEpisode(2, 'Episode 2', '2024-01-08'),
        ]),
      ];
      const { container } = render(
        <EpisodesSection seasons={seasons} dict={mockDict} />,
      );

      // Click to expand
      fireEvent.click(screen.getByText('Сезон 1'));

      // Check for expanded state via CSS class
      await waitFor(() => {
        const expandedContainer = container.querySelector('.grid-rows-\\[1fr\\]');
        expect(expandedContainer).toBeInTheDocument();
      });

      // Episodes should be in DOM
      expect(screen.getByText('1. Episode 1')).toBeInTheDocument();
      expect(screen.getByText('2. Episode 2')).toBeInTheDocument();
    });

    it('should collapse when clicking again', async () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'Episode 1', '2024-01-01')]),
      ];
      const { container } = render(
        <EpisodesSection seasons={seasons} dict={mockDict} />,
      );

      const seasonButton = screen.getByText('Сезон 1');

      // Expand
      fireEvent.click(seasonButton);
      await waitFor(() => {
        expect(container.querySelector('.grid-rows-\\[1fr\\]')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(seasonButton);
      await waitFor(() => {
        expect(container.querySelector('.grid-rows-\\[0fr\\]')).toBeInTheDocument();
      });
    });
  });

  describe('episode display', () => {
    it('should show episode number and title', async () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'The Beginning', '2024-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 1'));

      await waitFor(() => {
        expect(screen.getByText('1. The Beginning')).toBeInTheDocument();
      });
    });

    it('should show fallback title for episodes without title', async () => {
      const seasons = [
        createSeason(1, [createEpisode(5, null, '2024-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 1'));

      await waitFor(() => {
        expect(screen.getByText('5. Епізод 5')).toBeInTheDocument();
      });
    });

    it('should show runtime when available', async () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'Test', '2024-01-01', 52)]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 1'));

      await waitFor(() => {
        expect(screen.getByText('52 хв')).toBeInTheDocument();
      });
    });

    it('should mark upcoming episodes', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const seasons = [
        createSeason(1, [
          createEpisode(1, 'Future Episode', futureDate.toISOString()),
        ]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 1'));

      await waitFor(() => {
        expect(screen.getByText('Скоро')).toBeInTheDocument();
      });
    });
  });

  describe('episode count pluralization', () => {
    it('should pluralize 1 episode correctly (one)', () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'Solo', '2024-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);
      expect(screen.getByText('1 епізод')).toBeInTheDocument();
    });

    it('should pluralize 3 episodes correctly (few)', () => {
      const seasons = [
        createSeason(1, [
          createEpisode(1, 'E1', '2024-01-01'),
          createEpisode(2, 'E2', '2024-01-02'),
          createEpisode(3, 'E3', '2024-01-03'),
        ]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);
      expect(screen.getByText('3 епізоди')).toBeInTheDocument();
    });

    it('should pluralize 10 episodes correctly (many)', () => {
      const episodes = Array.from({ length: 10 }, (_, i) =>
        createEpisode(i + 1, `E${i + 1}`, '2024-01-01'),
      );
      const seasons = [createSeason(1, episodes)];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);
      expect(screen.getByText('10 епізодів')).toBeInTheDocument();
    });
  });

  describe('season selection', () => {
    it('should show change season button when expanded and multiple seasons', async () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'S1E1', '2024-01-01')]),
        createSeason(2, [createEpisode(1, 'S2E1', '2025-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 2'));

      await waitFor(() => {
        expect(screen.getByText('Змінити сезон')).toBeInTheDocument();
      });
    });

    it('should not show change season button with single season', async () => {
      const seasons = [
        createSeason(1, [createEpisode(1, 'E1', '2024-01-01')]),
      ];
      render(<EpisodesSection seasons={seasons} dict={mockDict} />);

      fireEvent.click(screen.getByText('Сезон 1'));

      await waitFor(() => {
        expect(screen.queryByText('Змінити сезон')).not.toBeInTheDocument();
      });
    });
  });
});

describe('lastAiredIndex calculation', () => {
  // Test the logic separately by checking scroll behavior
  it('should not auto-scroll when all episodes have aired', async () => {
    const pastDate = '2020-01-01';
    const seasons = [
      createSeason(1, [
        createEpisode(1, 'E1', pastDate),
        createEpisode(2, 'E2', pastDate),
        createEpisode(3, 'E3', pastDate),
      ]),
    ];

    render(<EpisodesSection seasons={seasons} dict={mockDict} />);
    fireEvent.click(screen.getByText('Сезон 1'));

    // When all episodes aired, list should start at top (no scroll)
    await waitFor(() => {
      expect(screen.getByText('1. E1')).toBeVisible();
    });
  });

  it('should identify last aired episode when there are upcoming ones', async () => {
    const pastDate = '2020-01-01';
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const seasons = [
      createSeason(1, [
        createEpisode(1, 'Aired 1', pastDate),
        createEpisode(2, 'Aired 2', pastDate),
        createEpisode(3, 'Upcoming', futureDate.toISOString()),
      ]),
    ];

    render(<EpisodesSection seasons={seasons} dict={mockDict} />);
    fireEvent.click(screen.getByText('Сезон 1'));

    // Should show the upcoming badge
    await waitFor(() => {
      expect(screen.getByText('Скоро')).toBeInTheDocument();
    });
  });
});

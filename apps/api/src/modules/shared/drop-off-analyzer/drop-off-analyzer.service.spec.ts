import { DropOffAnalyzerService } from './drop-off-analyzer.service';

describe('DropOffAnalyzerService', () => {
  let service: DropOffAnalyzerService;

  beforeEach(() => {
    service = new DropOffAnalyzerService();
  });

  describe('analyze', () => {
    it('should return empty analysis for empty seasons', () => {
      const result = service.analyze([]);

      expect(result.dropOffPoint).toBeNull();
      expect(result.episodesAnalyzed).toBe(0);
      expect(result.insight).toBe('Недостатньо даних для аналізу');
    });

    it('should return empty analysis for less than 3 episodes', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.0, votes: 1000 },
            { number: 2, title: 'Episode 2', rating: 7.5, votes: 900 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.dropOffPoint).toBeNull();
      expect(result.episodesAnalyzed).toBe(0);
    });

    it('should detect drop-off when rating and votes drop significantly', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.5, votes: 10000 },
            { number: 2, title: 'Episode 2', rating: 8.3, votes: 9500 },
            { number: 3, title: 'Episode 3', rating: 8.0, votes: 9000 },
            { number: 4, title: 'Episode 4', rating: 6.5, votes: 4000 }, // Drop-off: rating -1.5, votes -55%
            { number: 5, title: 'Episode 5', rating: 6.0, votes: 3500 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.dropOffPoint).not.toBeNull();
      expect(result.dropOffPoint?.season).toBe(1);
      expect(result.dropOffPoint?.episode).toBe(4);
      expect(result.dropOffPercent).toBeGreaterThan(40);
    });

    it('should return steady insight when no significant drop-off', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.0, votes: 1000 },
            { number: 2, title: 'Episode 2', rating: 7.9, votes: 980 },
            { number: 3, title: 'Episode 3', rating: 7.8, votes: 950 },
            { number: 4, title: 'Episode 4', rating: 7.7, votes: 920 },
            { number: 5, title: 'Episode 5', rating: 7.6, votes: 900 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.dropOffPoint).toBeNull();
      expect(result.insightType).toBe('steady');
    });

    it('should calculate season engagement correctly', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'S1E1', rating: 8.0, votes: 1000 },
            { number: 2, title: 'S1E2', rating: 8.2, votes: 1100 },
          ],
        },
        {
          number: 2,
          episodes: [
            { number: 1, title: 'S2E1', rating: 7.5, votes: 700 },
            { number: 2, title: 'S2E2', rating: 7.3, votes: 650 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.seasonEngagement).toHaveLength(2);
      expect(result.seasonEngagement[0].season).toBe(1);
      expect(result.seasonEngagement[0].avgVotes).toBe(1050); // (1000+1100)/2
      expect(result.seasonEngagement[1].season).toBe(2);
      expect(result.seasonEngagement[1].engagementDrop).toBeGreaterThan(0);
    });

    it('should calculate overall retention correctly', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'S1E1', rating: 8.0, votes: 1000 },
            { number: 2, title: 'S1E2', rating: 8.0, votes: 1000 },
          ],
        },
        {
          number: 2,
          episodes: [
            { number: 1, title: 'S2E1', rating: 7.0, votes: 500 },
            { number: 2, title: 'S2E2', rating: 7.0, votes: 500 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      // S1 avg: 1000, S2 avg: 500 → retention = 50%
      expect(result.overallRetention).toBe(50);
    });

    it('should ignore episodes with too few votes', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.0, votes: 1000 },
            { number: 2, title: 'Episode 2', rating: 2.0, votes: 10 }, // Should be ignored (< 100 votes)
            { number: 3, title: 'Episode 3', rating: 7.8, votes: 950 },
            { number: 4, title: 'Episode 4', rating: 7.6, votes: 900 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      // Episode 2 should not trigger drop-off due to low votes
      expect(result.dropOffPoint).toBeNull();
    });

    it('should detect early drop-off correctly', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.5, votes: 10000 },
            { number: 2, title: 'Episode 2', rating: 6.0, votes: 3000 }, // Early drop
            { number: 3, title: 'Episode 3', rating: 5.5, votes: 2500 },
            { number: 4, title: 'Episode 4', rating: 5.0, votes: 2000 },
            { number: 5, title: 'Episode 5', rating: 4.5, votes: 1500 },
            { number: 6, title: 'Episode 6', rating: 4.0, votes: 1000 },
            { number: 7, title: 'Episode 7', rating: 3.5, votes: 800 },
            { number: 8, title: 'Episode 8', rating: 3.0, votes: 600 },
            { number: 9, title: 'Episode 9', rating: 2.5, votes: 500 },
            { number: 10, title: 'Episode 10', rating: 2.0, votes: 400 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.dropOffPoint?.episode).toBe(2);
      expect(result.insightType).toBe('drops_early');
    });

    it('should detect late drop-off in later seasons', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'S1E1', rating: 8.5, votes: 10000 },
            { number: 2, title: 'S1E2', rating: 8.4, votes: 9800 },
            { number: 3, title: 'S1E3', rating: 8.3, votes: 9600 },
          ],
        },
        {
          number: 2,
          episodes: [
            { number: 1, title: 'S2E1', rating: 8.0, votes: 9000 },
            { number: 2, title: 'S2E2', rating: 7.8, votes: 8500 },
            { number: 3, title: 'S2E3', rating: 7.5, votes: 8000 },
          ],
        },
        {
          number: 3,
          episodes: [
            { number: 1, title: 'S3E1', rating: 5.5, votes: 3000 }, // Drop-off here
            { number: 2, title: 'S3E2', rating: 5.0, votes: 2500 },
            { number: 3, title: 'S3E3', rating: 4.5, votes: 2000 },
          ],
        },
      ];

      const result = service.analyze(seasons);

      expect(result.dropOffPoint?.season).toBe(3);
      expect(result.dropOffPoint?.episode).toBe(1);
      expect(result.insightType).toBe('drops_late');
    });

    it('should include analyzedAt timestamp', () => {
      const seasons = [
        {
          number: 1,
          episodes: [
            { number: 1, title: 'Pilot', rating: 8.0, votes: 1000 },
            { number: 2, title: 'Episode 2', rating: 7.9, votes: 980 },
            { number: 3, title: 'Episode 3', rating: 7.8, votes: 950 },
          ],
        },
      ];

      const before = new Date().toISOString();
      const result = service.analyze(seasons);
      const after = new Date().toISOString();

      expect(result.analyzedAt).toBeDefined();
      expect(result.analyzedAt >= before).toBe(true);
      expect(result.analyzedAt <= after).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle single season with many episodes', () => {
      const episodes = Array.from({ length: 50 }, (_, i) => ({
        number: i + 1,
        title: `Episode ${i + 1}`,
        rating: 8.0 - i * 0.02,
        votes: 1000 - i * 10,
      }));

      const seasons = [{ number: 1, episodes }];

      const result = service.analyze(seasons);

      expect(result.episodesAnalyzed).toBe(50);
      expect(result.seasonEngagement).toHaveLength(1);
    });

    it('should handle seasons with varying episode counts', () => {
      const seasons = [
        {
          number: 1,
          episodes: Array.from({ length: 10 }, (_, i) => ({
            number: i + 1,
            title: `S1E${i + 1}`,
            rating: 8.0,
            votes: 1000,
          })),
        },
        {
          number: 2,
          episodes: Array.from({ length: 5 }, (_, i) => ({
            number: i + 1,
            title: `S2E${i + 1}`,
            rating: 7.5,
            votes: 800,
          })),
        },
      ];

      const result = service.analyze(seasons);

      expect(result.episodesAnalyzed).toBe(15);
    });
  });
});

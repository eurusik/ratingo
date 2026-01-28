import { isReadableTitle } from './title-readability';

describe('TitleReadability', () => {
  describe('isReadableTitle', () => {
    it('should return false for empty title', () => {
      expect(isReadableTitle('')).toBe(false);
    });

    it('should return false for null-like empty string', () => {
      expect(isReadableTitle('')).toBe(false);
    });

    describe('Latin/Cyrillic titles', () => {
      it('should return true for English title', () => {
        expect(isReadableTitle('The Matrix')).toBe(true);
      });

      it('should return true for Ukrainian title', () => {
        expect(isReadableTitle('Матриця')).toBe(true);
      });

      it('should return true for mixed Latin and Cyrillic', () => {
        expect(isReadableTitle('The Matrix - Матриця')).toBe(true);
      });

      it('should return true for short Latin title', () => {
        expect(isReadableTitle('Up')).toBe(true);
      });

      it('should return true for single letter titles', () => {
        // Even short titles with 2+ Latin/Cyrillic are readable
        expect(isReadableTitle('IT')).toBe(true);
      });
    });

    describe('CJK-only titles', () => {
      it('should return false for long Japanese title', () => {
        expect(isReadableTitle('ファイナルファンタジー')).toBe(false);
      });

      it('should return false for long Chinese title', () => {
        expect(isReadableTitle('功夫熊猫大电影')).toBe(false);
      });

      it('should return false for long Korean title', () => {
        expect(isReadableTitle('기생충인생영화')).toBe(false);
      });

      it('should return false for short CJK title (no length exception)', () => {
        // Short CJK titles are NOT readable - no exception for length
        // 功夫 (Kung Fu) is not readable for UA users without translation
        expect(isReadableTitle('功夫')).toBe(false);
        expect(isReadableTitle('千と千')).toBe(false);
        expect(isReadableTitle('기생충')).toBe(false); // Parasite
      });
    });

    describe('Mixed CJK and Latin/Cyrillic titles', () => {
      it('should return true when CJK title has Latin suffix', () => {
        expect(isReadableTitle('ファイナルファンタジー (Final Fantasy)')).toBe(true);
      });

      it('should return true when 2+ Latin chars present', () => {
        expect(isReadableTitle('千と千尋の神隠し - AB')).toBe(true);
      });

      it('should return false when only 1 Latin char with heavy CJK', () => {
        expect(isReadableTitle('千と千尋の神隠し X')).toBe(false);
      });

      it('should return false for CJK with only numbers (no Latin/Cyrillic)', () => {
        // Numbers don't count as letters, CJK is still unreadable
        expect(isReadableTitle('千と1')).toBe(false);
        expect(isReadableTitle('功夫2')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should return true for numbers only', () => {
        // No letters, so no CJK ratio check triggers
        expect(isReadableTitle('2001')).toBe(true);
      });

      it('should return true for punctuation only', () => {
        expect(isReadableTitle('...')).toBe(true);
      });

      it('should return true for emoji title', () => {
        // Emoji not counted as CJK or Latin
        expect(isReadableTitle('🎬🎥')).toBe(true);
      });

      it('should handle mixed scripts with numbers', () => {
        expect(isReadableTitle('Final Fantasy VII')).toBe(true);
        expect(isReadableTitle('千と千尋 2001')).toBe(false); // Still CJK-heavy
      });
    });
  });
});

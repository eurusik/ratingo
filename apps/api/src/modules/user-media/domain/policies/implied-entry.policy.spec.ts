import { USER_MEDIA_STATE, type UserMediaState } from '../entities/user-media-state.entity';

import {
  hasUserAuthoredData,
  isDisposableImpliedEntry,
  stateImpliedFor,
} from './implied-entry.policy';

const entry = (overrides: Partial<UserMediaState> = {}): UserMediaState =>
  ({
    state: USER_MEDIA_STATE.WATCHING,
    rating: null,
    progress: null,
    notes: null,
    stateImplied: true,
    ...overrides,
  }) as UserMediaState;

describe('implied entry policy', () => {
  describe('stateImpliedFor', () => {
    it('is false when the user picks a state', () => {
      expect(stateImpliedFor({ state: USER_MEDIA_STATE.COMPLETED }, entry())).toBe(false);
      expect(stateImpliedFor({ state: USER_MEDIA_STATE.COMPLETED }, null)).toBe(false);
    });

    it('is true for a first row the system creates', () => {
      expect(stateImpliedFor({}, null)).toBe(true);
      expect(stateImpliedFor({ state: USER_MEDIA_STATE.WATCHING, stateImplied: true }, null)).toBe(
        true,
      );
    });

    it('leaves an existing row untouched when the system changes it', () => {
      expect(stateImpliedFor({}, entry({ stateImplied: false }))).toBeUndefined();
      expect(
        stateImpliedFor(
          { state: USER_MEDIA_STATE.WATCHING, stateImplied: true },
          entry({ stateImplied: false }),
        ),
      ).toBeUndefined();
    });
  });

  describe('hasUserAuthoredData', () => {
    it.each([
      [{ rating: 0, notes: null }, true],
      [{ rating: null, notes: 'rewatch' }, true],
      [{ rating: null, notes: '   ' }, false],
      [{ rating: null, notes: null }, false],
    ])('%o → %s', (data, expected) => {
      expect(hasUserAuthoredData(data)).toBe(expected);
    });
  });

  describe('isDisposableImpliedEntry', () => {
    it('is true for a bare implied entry with no episodes', () => {
      expect(isDisposableImpliedEntry(entry(), 0)).toBe(true);
    });

    it.each([
      ['the user chose the state', { stateImplied: false }, 0],
      ['it has a rating', { rating: 70 }, 0],
      ['it has notes', { notes: 'rewatch' }, 0],
      ['it has progress', { progress: { seasons: { 1: 2 } } }, 0],
      ['episodes are marked', {}, 2],
    ])('is false when %s', (_label, overrides, watched) => {
      expect(isDisposableImpliedEntry(entry(overrides), watched)).toBe(false);
    });
  });
});

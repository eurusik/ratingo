/**
 * Tests for CatchUpDialog component.
 *
 * The dialog lets users choose which seasons to mark as watched (catch-up)
 * and which fully-watched seasons to unmark. It maintains bidirectional
 * selection state and produces distinct toMark / toUnmark maps on confirm.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { CatchUpDialog, type CatchUpDialogProps } from '../catch-up-dialog';

// ---------------------------------------------------------------------------
// Dict fixture — only the keys actually consumed by the component
// ---------------------------------------------------------------------------

const mockDict = {
  details: {
    showStatus: {
      season: 'Сезон',
      confirmMarkAll: 'Позначити всі випущені серії як переглянуті?',
      selectSeasonsMessage: 'Обери сезони для позначення',
      allSeasons: 'Всі сезони',
      seasonFullyWatched: 'переглянуто',
      markAllWatched: 'Наздогнати',
      willBeMarked: 'Буде позначено: {count} {episodes}',
      willBeUnmarked: 'Буде знято: {count} {episodes}',
      plurals: {
        episode: { one: 'епізод', few: 'епізоди', many: 'епізодів' },
        season: { one: 'сезон', few: 'сезони', many: 'сезонів' },
      },
    },
  },
  common: {
    cancel: 'Скасувати',
    save: 'Зберегти',
  },
} as ReturnType<typeof import('@/shared/i18n').getDictionary>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSeason(number: number, name?: string) {
  return { number, name: name ?? null } as import('@ratingo/api-contract').components['schemas']['SeasonDto'];
}

function buildEpisodesMap(entries: [number, string[]][]) {
  return new Map<number, string[]>(entries);
}

function buildProgress(
  seasons: Array<{
    seasonNumber: number;
    watchedCount: number;
    watchedEpisodeIds: string[];
    totalCount: number;
  }>,
): import('@/core/api/episode-progress.client').ShowProgressDto {
  return {
    showId: 'show-1',
    seasons: seasons.map((s) => ({
      seasonNumber: s.seasonNumber,
      totalCount: s.totalCount,
      watchedCount: s.watchedCount,
      watchedEpisodeIds: s.watchedEpisodeIds,
    })),
  };
}

function renderDialog(overrides: Partial<CatchUpDialogProps> = {}) {
  const defaults: CatchUpDialogProps = {
    open: true,
    onOpenChange: jest.fn(),
    validSeasons: [buildSeason(1), buildSeason(2), buildSeason(3)],
    allEpisodesBySeasonNumber: buildEpisodesMap([
      [1, ['ep-1-1', 'ep-1-2']],
      [2, ['ep-2-1', 'ep-2-2']],
      [3, ['ep-3-1', 'ep-3-2']],
    ]),
    progressData: undefined,
    dict: mockDict,
    onConfirm: jest.fn(),
    isPending: false,
  };

  return render(<CatchUpDialog {...defaults} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Convenience query helpers
// ---------------------------------------------------------------------------

/** Returns all Radix Checkbox roots visible in the dialog. */
function getAllCheckboxes() {
  return screen.getAllByRole('checkbox');
}

/**
 * Radix Checkbox renders a <button role="checkbox"> with aria-checked.
 * The master checkbox is the one labelled "Всі сезони".
 */
function getMasterCheckbox() {
  return screen.getByRole('checkbox', { name: /всі сезони/i });
}

function getConfirmButton() {
  return screen.getByRole('button', { name: /наздогнати|зберегти/i });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CatchUpDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Pre-selects ALL seasons by default
  // -------------------------------------------------------------------------

  describe('default selection', () => {
    it('pre-selects all seasons when dialog opens', () => {
      renderDialog();

      const checkboxes = getAllCheckboxes();
      // master + 3 season rows = 4 checkboxes
      expect(checkboxes).toHaveLength(4);

      // All season-row checkboxes should be checked (aria-checked="true")
      // The master checkbox should also be checked because all are selected
      checkboxes.forEach((cb) => {
        expect(cb).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('resets selection back to all-selected when dialog re-opens', () => {
      const onOpenChange = jest.fn();
      const onConfirm = jest.fn();
      const stableSeasons = [buildSeason(1), buildSeason(2), buildSeason(3)];
      const stableEpisodes = buildEpisodesMap([
        [1, ['ep-1-1', 'ep-1-2']],
        [2, ['ep-2-1', 'ep-2-2']],
        [3, ['ep-3-1', 'ep-3-2']],
      ]);

      const stableProps: CatchUpDialogProps = {
        open: true,
        onOpenChange,
        validSeasons: stableSeasons,
        allEpisodesBySeasonNumber: stableEpisodes,
        progressData: undefined,
        dict: mockDict,
        onConfirm,
        isPending: false,
      };

      const { rerender } = render(<CatchUpDialog {...stableProps} />);

      // Uncheck season 1 row (second checkbox — first is master)
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]);

      // Season 1 is now unchecked
      expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');

      // Simulate close then re-open — only `open` changes
      rerender(<CatchUpDialog {...stableProps} open={false} />);
      rerender(<CatchUpDialog {...stableProps} open />);

      // All checkboxes should be checked again
      const freshCheckboxes = getAllCheckboxes();
      freshCheckboxes.forEach((cb) => {
        expect(cb).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Fully-watched seasons show "переглянуто" label and are NOT disabled
  // -------------------------------------------------------------------------

  describe('fully-watched season display', () => {
    it('shows "переглянуто" badge for fully-watched seasons', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 0, watchedEpisodeIds: [], totalCount: 2 },
        ]),
      });

      expect(screen.getByText('переглянуто')).toBeInTheDocument();
    });

    it('fully-watched season checkbox is NOT disabled — can be unchecked', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
        ]),
      });

      // Only one season row (no master checkbox when count ≤ 1)
      const seasonCheckbox = screen.getByRole('checkbox');
      expect(seasonCheckbox).not.toBeDisabled();
      expect(seasonCheckbox).toHaveAttribute('aria-checked', 'true');

      // Can be unchecked
      fireEvent.click(seasonCheckbox);
      expect(seasonCheckbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Unchecking a fully-watched season includes it in toUnmark
  // -------------------------------------------------------------------------

  describe('toUnmark population', () => {
    it('unchecking a fully-watched season passes its watched IDs in toUnmark', () => {
      const onConfirm = jest.fn();
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 0, watchedEpisodeIds: [], totalCount: 2 },
        ]),
        onConfirm,
      });

      // checkboxes: master(0), S1(1), S2(2)
      const checkboxes = getAllCheckboxes();
      // Uncheck S1 (fully watched)
      fireEvent.click(checkboxes[1]);

      // Confirm
      fireEvent.click(getConfirmButton());

      expect(onConfirm).toHaveBeenCalledTimes(1);
      const [toMark, toUnmark] = onConfirm.mock.calls[0] as [Map<number, string[]>, Map<number, string[]>];

      // S1 fully watched → unchecked → should be in toUnmark
      expect(toUnmark.get(1)).toEqual(['ep-1-1', 'ep-1-2']);
      // S2 not fully watched → selected → should be in toMark
      expect(toMark.get(2)).toEqual(['ep-2-1', 'ep-2-2']);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Checking an unwatched season includes it in toMark
  // -------------------------------------------------------------------------

  describe('toMark population', () => {
    it('a selected unwatched season is included in toMark on confirm', () => {
      const onConfirm = jest.fn();
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2', 'ep-1-3']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 0, watchedEpisodeIds: [], totalCount: 3 },
        ]),
        onConfirm,
      });

      // S1 is already selected (default), confirm immediately
      fireEvent.click(getConfirmButton());

      const [toMark, toUnmark] = onConfirm.mock.calls[0] as [Map<number, string[]>, Map<number, string[]>];
      expect(toMark.get(1)).toEqual(['ep-1-1', 'ep-1-2', 'ep-1-3']);
      expect(toUnmark.size).toBe(0);
    });

    it('deselecting an unwatched season removes it from toMark', () => {
      const onConfirm = jest.fn();
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
        ]),
        progressData: undefined,
        onConfirm,
      });

      // Uncheck S1 (unwatched, not fully watched)
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]); // S1 row

      fireEvent.click(getConfirmButton());

      const [toMark, toUnmark] = onConfirm.mock.calls[0] as [Map<number, string[]>, Map<number, string[]>];
      // S1 deselected but not fully-watched → not in toUnmark
      expect(toUnmark.has(1)).toBe(false);
      // S2 still selected and unwatched → in toMark
      expect(toMark.get(2)).toEqual(['ep-2-1', 'ep-2-2']);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Mixed scenario: uncheck watched S1, keep watched S2, check unwatched S3
  // -------------------------------------------------------------------------

  describe('mixed scenario', () => {
    it('produces correct toMark and toUnmark for a mixed selection', () => {
      const onConfirm = jest.fn();
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2), buildSeason(3)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
          [3, ['ep-3-1', 'ep-3-2', 'ep-3-3']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 2, watchedEpisodeIds: ['ep-2-1', 'ep-2-2'], totalCount: 2 },
          { seasonNumber: 3, watchedCount: 0, watchedEpisodeIds: [], totalCount: 3 },
        ]),
        onConfirm,
      });

      // checkboxes: master(0), S1(1), S2(2), S3(3)
      const checkboxes = getAllCheckboxes();

      // Uncheck S1 (fully watched) → goes to toUnmark
      fireEvent.click(checkboxes[1]);

      // Keep S2 selected (fully watched) → no action (already watched)
      // S3 stays selected (not fully watched) → goes to toMark

      fireEvent.click(getConfirmButton());

      const [toMark, toUnmark] = onConfirm.mock.calls[0] as [Map<number, string[]>, Map<number, string[]>];

      // S3 not fully watched & selected → toMark
      expect(toMark.get(3)).toEqual(['ep-3-1', 'ep-3-2', 'ep-3-3']);
      expect(toMark.has(2)).toBe(false); // S2 fully watched & selected → nothing
      expect(toMark.has(1)).toBe(false); // S1 deselected

      // S1 fully watched & deselected → toUnmark
      expect(toUnmark.get(1)).toEqual(['ep-1-1', 'ep-1-2']);
      expect(toUnmark.has(2)).toBe(false); // S2 still selected → not in toUnmark
      expect(toUnmark.has(3)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Master checkbox toggles all seasons
  // -------------------------------------------------------------------------

  describe('master checkbox', () => {
    it('deselects all season rows when master is clicked while all are selected', () => {
      renderDialog();

      const master = getMasterCheckbox();
      // Initially all selected → master is checked
      expect(master).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(master);

      // All checkboxes should now be unchecked
      getAllCheckboxes().forEach((cb) => {
        expect(cb).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('selects all season rows when master is clicked while none are selected', () => {
      renderDialog();

      const master = getMasterCheckbox();
      // Deselect all first
      fireEvent.click(master);

      getAllCheckboxes().forEach((cb) => {
        expect(cb).toHaveAttribute('aria-checked', 'false');
      });

      // Re-select all
      fireEvent.click(master);

      getAllCheckboxes().forEach((cb) => {
        expect(cb).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('shows indeterminate state when only some seasons are selected', () => {
      renderDialog();

      // Uncheck one season row to get partial selection
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]); // uncheck S1

      const master = getMasterCheckbox();
      expect(master).toHaveAttribute('aria-checked', 'mixed');
    });

    it('master checkbox is not rendered when there is only one season', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1']]]),
      });

      // Only one season → no master checkbox
      expect(screen.queryByRole('checkbox', { name: /всі сезони/i })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Confirm button disabled when no changes
  // -------------------------------------------------------------------------

  describe('confirm button disabled state', () => {
    it('is disabled when all selected seasons are already fully watched (no changes)', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 2, watchedEpisodeIds: ['ep-2-1', 'ep-2-2'], totalCount: 2 },
        ]),
      });

      // Both seasons fully watched & selected → totalToMark=0, totalToUnmark=0
      expect(getConfirmButton()).toBeDisabled();
    });

    it('is enabled when at least one unwatched season is selected', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1', 'ep-1-2']]]),
        progressData: undefined,
      });

      expect(getConfirmButton()).not.toBeDisabled();
    });

    it('is disabled when all seasons are deselected', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1']],
          [2, ['ep-2-1']],
        ]),
        progressData: undefined,
      });

      // Deselect all via master
      fireEvent.click(getMasterCheckbox());

      expect(getConfirmButton()).toBeDisabled();
    });

    it('is disabled when isPending is true', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1']]]),
        progressData: undefined,
        isPending: true,
      });

      expect(getConfirmButton()).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Summary shows both mark and unmark counts
  // -------------------------------------------------------------------------

  describe('summary live region', () => {
    it('shows willBeMarked text when there are episodes to mark', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1', 'ep-1-2', 'ep-1-3']]]),
        progressData: undefined,
      });

      const summary = screen.getByRole('status');
      expect(summary.textContent).toContain('Буде позначено: 3');
      expect(summary.textContent).toContain('епізоди');
    });

    it('shows willBeUnmarked text when a fully-watched season is deselected', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 2, watchedEpisodeIds: ['ep-2-1', 'ep-2-2'], totalCount: 2 },
        ]),
      });

      // Uncheck S1 (fully watched)
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]);

      const summary = screen.getByRole('status');
      expect(summary.textContent).toContain('Буде знято: 2');
    });

    it('shows both mark and unmark text in mixed scenario', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1', 'ep-2-2', 'ep-2-3']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 0, watchedEpisodeIds: [], totalCount: 3 },
        ]),
      });

      // Uncheck S1 (fully watched) — adds to toUnmark
      // S2 stays selected (unwatched) — adds to toMark
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]);

      const summary = screen.getByRole('status');
      expect(summary.textContent).toContain('Буде позначено');
      expect(summary.textContent).toContain('Буде знято');
    });

    it('shows a non-breaking space when there are no changes', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1']]]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 1, watchedEpisodeIds: ['ep-1-1'], totalCount: 1 },
        ]),
      });

      const summary = screen.getByRole('status');
      // Both S1 fully watched & selected → 0 to mark, 0 to unmark → nbsp placeholder
      expect(summary.textContent).toBe('\u00A0');
    });
  });

  // -------------------------------------------------------------------------
  // 9. Dynamic button label
  // -------------------------------------------------------------------------

  describe('dynamic confirm button label', () => {
    it('shows "Наздогнати" when there are only episodes to mark (no unmark)', () => {
      renderDialog({
        validSeasons: [buildSeason(1)],
        allEpisodesBySeasonNumber: buildEpisodesMap([[1, ['ep-1-1', 'ep-1-2']]]),
        progressData: undefined,
      });

      expect(screen.getByRole('button', { name: 'Наздогнати' })).toBeInTheDocument();
    });

    it('shows "Зберегти" when there is at least one season to unmark', () => {
      renderDialog({
        validSeasons: [buildSeason(1), buildSeason(2)],
        allEpisodesBySeasonNumber: buildEpisodesMap([
          [1, ['ep-1-1', 'ep-1-2']],
          [2, ['ep-2-1']],
        ]),
        progressData: buildProgress([
          { seasonNumber: 1, watchedCount: 2, watchedEpisodeIds: ['ep-1-1', 'ep-1-2'], totalCount: 2 },
          { seasonNumber: 2, watchedCount: 0, watchedEpisodeIds: [], totalCount: 1 },
        ]),
      });

      // Uncheck S1 (fully watched) → totalToUnmark > 0
      const checkboxes = getAllCheckboxes();
      fireEvent.click(checkboxes[1]);

      expect(screen.getByRole('button', { name: 'Зберегти' })).toBeInTheDocument();
    });
  });
});

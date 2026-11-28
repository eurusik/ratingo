import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { Episode } from '../model/season';
import { EpisodeRow } from './episode-row';

const EPISODE: Episode = {
  id: 'e3',
  seasonNumber: 1,
  number: 3,
  title: 'Reckoning',
  airDate: '2022-09-21',
  runtimeMinutes: 40,
};

const MARK = 'С1 · Е3: Reckoning';
const OPEN = 'Опис серії С1 · Е3: Reckoning';

function renderRow(props: Partial<Parameters<typeof EpisodeRow>[0]>) {
  return render(
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      <ul>
        <EpisodeRow episode={EPISODE} isAired {...props} />
      </ul>
    </I18nProvider>,
  );
}

describe('EpisodeRow', () => {
  it('marks an aired episode when the row is pressed', () => {
    const onWatchedChange = jest.fn();
    renderRow({ onWatchedChange });

    const row = screen.getByRole('button', { name: MARK });
    expect(row).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(row);
    expect(onWatchedChange).toHaveBeenCalledWith(EPISODE, true);
  });

  it('unmarks a watched episode', () => {
    const onWatchedChange = jest.fn();
    renderRow({ isWatched: true, onWatchedChange });

    const row = screen.getByRole('button', { name: MARK });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(row);
    expect(onWatchedChange).toHaveBeenCalledWith(EPISODE, false);
  });

  it('opens the description from the still without marking the episode', () => {
    const onOpen = jest.fn();
    const onWatchedChange = jest.fn();
    renderRow({ onOpen, onWatchedChange });

    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(onOpen).toHaveBeenCalledWith(EPISODE);
    expect(onWatchedChange).not.toHaveBeenCalled();
  });

  it('opens the episode menu on right click instead of marking', () => {
    const onMenu = jest.fn();
    const onWatchedChange = jest.fn();
    renderRow({ onMenu, onWatchedChange });

    const row = screen.getByRole('button', { name: MARK });
    fireEvent.contextMenu(row);
    expect(onMenu).toHaveBeenCalledWith(EPISODE, row);
    expect(onWatchedChange).not.toHaveBeenCalled();
  });

  it('keeps the browser menu when the row has no episode menu', () => {
    renderRow({ onWatchedChange: jest.fn() });

    const event = fireEvent.contextMenu(screen.getByRole('button', { name: MARK }));
    expect(event).toBe(true);
  });

  it('signals intent to open on hover and focus so the description can load early', () => {
    const onOpenIntent = jest.fn();
    renderRow({ onWatchedChange: jest.fn(), onOpen: jest.fn(), onOpenIntent });
    const open = screen.getByRole('button', { name: OPEN });

    fireEvent.pointerEnter(open);
    fireEvent.focus(open);
    expect(onOpenIntent).toHaveBeenCalledTimes(2);
    expect(onOpenIntent).toHaveBeenCalledWith(EPISODE);
  });

  it('opens an episode that has not aired from the whole row, with nothing to mark', () => {
    const onOpen = jest.fn();
    renderRow({ isAired: false, onOpen, onWatchedChange: jest.fn() });

    expect(screen.queryByRole('button', { name: MARK })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(onOpen).toHaveBeenCalledWith(EPISODE);
  });

  it('picks instead of opening while choosing where the viewer stopped', () => {
    const onPick = jest.fn();
    renderRow({ onOpen: jest.fn(), onWatchedChange: jest.fn(), onPick });

    expect(screen.queryByRole('button', { name: OPEN })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: MARK }));
    expect(onPick).toHaveBeenCalledWith(EPISODE);
  });

  it('offers no toggle for an episode that has not aired', () => {
    renderRow({ isAired: false, onWatchedChange: jest.fn() });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says the date is not known yet for an episode without an air date', () => {
    renderRow({ episode: { ...EPISODE, airDate: undefined }, isAired: false });

    expect(screen.getByText(/Дата ще невідома/)).toBeInTheDocument();
  });
});

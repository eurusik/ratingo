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
  it('toggles an aired episode as a checkbox named after the episode', () => {
    const onWatchedChange = jest.fn();
    renderRow({ onWatchedChange });

    const checkbox = screen.getByRole('checkbox', { name: 'С1 · Е3: Reckoning' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onWatchedChange).toHaveBeenCalledWith(EPISODE, true);
  });

  it('unmarks a watched episode', () => {
    const onWatchedChange = jest.fn();
    renderRow({ isWatched: true, onWatchedChange });

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onWatchedChange).toHaveBeenCalledWith(EPISODE, false);
  });

  it('opens the episode from its title and keeps the checkbox for marking it', () => {
    const onOpen = jest.fn();
    const onWatchedChange = jest.fn();
    renderRow({ onOpen, onWatchedChange });

    fireEvent.click(screen.getByRole('button', { name: 'Опис серії С1 · Е3: Reckoning' }));
    expect(onOpen).toHaveBeenCalledWith(EPISODE);
    expect(onWatchedChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'С1 · Е3: Reckoning' }));
    expect(onWatchedChange).toHaveBeenCalledWith(EPISODE, true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('signals intent to open on hover and focus so the description can load early', () => {
    const onOpenIntent = jest.fn();
    renderRow({ onOpen: jest.fn(), onOpenIntent });
    const open = screen.getByRole('button', { name: /Опис серії/ });

    fireEvent.pointerEnter(open);
    fireEvent.focus(open);
    expect(onOpenIntent).toHaveBeenCalledTimes(2);
    expect(onOpenIntent).toHaveBeenCalledWith(EPISODE);
  });

  it('opens an episode that has not aired, with nothing to mark', () => {
    const onOpen = jest.fn();
    renderRow({ isAired: false, onOpen, onWatchedChange: jest.fn() });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Опис серії/ }));
    expect(onOpen).toHaveBeenCalledWith(EPISODE);
  });

  it('picks instead of opening while choosing where the viewer stopped', () => {
    const onOpen = jest.fn();
    renderRow({ onOpen, onPick: jest.fn() });

    expect(screen.queryByRole('button', { name: /Опис серії/ })).not.toBeInTheDocument();
  });

  it('offers no toggle for an episode that has not aired', () => {
    renderRow({ isAired: false, onWatchedChange: jest.fn() });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says the date is not known yet for an episode without an air date', () => {
    renderRow({ episode: { ...EPISODE, airDate: undefined }, isAired: false });

    expect(screen.getByText(/Дата ще невідома/)).toBeInTheDocument();
  });

  it('becomes a pick button while choosing where the viewer stopped', () => {
    const onPick = jest.fn();
    renderRow({ onWatchedChange: jest.fn(), onPick });

    fireEvent.click(screen.getByRole('button', { name: 'С1 · Е3: Reckoning' }));
    expect(onPick).toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

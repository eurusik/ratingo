import { fireEvent, render, screen } from '@testing-library/react';
import type { Episode } from '@/entities/episode';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';
import { EpisodeMenu } from './episode-menu';

const episode = (number: number): Episode => ({
  id: `e${number}`,
  seasonNumber: 1,
  number,
  title: `Серія ${number}`,
  airDate: '2026-11-01T20:00:00.000Z',
});
const E2 = episode(2);
const E3 = episode(3);
const E4 = episode(4);

function renderMenu(target: Episode, tracker: Partial<EpisodesTracker>) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  const handlers = { onOpen: jest.fn(), onClose: jest.fn() };
  const fullTracker = {
    watched: new Set<string>(),
    rangeThrough: () => [target],
    markOnly: jest.fn(),
    toggle: jest.fn(),
    ...tracker,
  } as unknown as EpisodesTracker;
  render(
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      <EpisodeMenu target={{ episode: target, anchor }} tracker={fullTracker} {...handlers} />
    </I18nProvider>,
  );
  return { ...handlers, tracker: fullTracker };
}

describe('EpisodeMenu', () => {
  it('offers to mark only this episode or every unwatched one up to it', () => {
    const { tracker, onClose } = renderMenu(E4, { rangeThrough: () => [E2, E3, E4] });

    expect(screen.getByRole('menuitem', { name: /Опис серії/ })).toBeInTheDocument();
    expect(screen.getByText('Е2–Е4, 3 серії')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /Позначити тільки цю/ }));
    expect(tracker.markOnly).toHaveBeenCalledWith(E4);
    expect(onClose).toHaveBeenCalled();
  });

  it('marks the whole range through the regular toggle', () => {
    const { tracker } = renderMenu(E4, { rangeThrough: () => [E2, E3, E4] });

    fireEvent.click(screen.getByRole('menuitem', { name: /Позначити всі до цієї/ }));
    expect(tracker.toggle).toHaveBeenCalledWith(E4, true);
  });

  it('skips the range item when only this episode is unwatched', () => {
    renderMenu(E2, {});

    expect(
      screen.queryByRole('menuitem', { name: /Позначити всі до цієї/ }),
    ).not.toBeInTheDocument();
  });

  it('offers to unmark a watched episode and to open its description', () => {
    const { tracker, onOpen } = renderMenu(E3, { watched: new Set(['e3']) });

    expect(screen.queryByRole('menuitem', { name: /Позначити тільки цю/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Зняти позначку/ }));
    expect(tracker.toggle).toHaveBeenCalledWith(E3, false);

    fireEvent.click(screen.getByRole('menuitem', { name: /Опис серії/ }));
    expect(onOpen).toHaveBeenCalledWith(E3);
  });
});

import { render, screen, within } from '@testing-library/react';
import { Rail, RailItem } from './rail';

describe('Rail', () => {
  it('renders a labelled list of items', () => {
    render(
      <Rail label="Зараз у тренді">
        <RailItem>Перший</RailItem>
        <RailItem>Другий</RailItem>
      </Rail>,
    );

    const list = screen.getByRole('list', { name: 'Зараз у тренді' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.tagName).toBe('UL');
  });

  it('renders an ordered list for rankings', () => {
    render(
      <Rail label="Топ-10" isOrdered>
        <RailItem>Перший</RailItem>
      </Rail>,
    );

    expect(screen.getByRole('list', { name: 'Топ-10' }).tagName).toBe('OL');
  });

  it('sizes tiles for denser rails', () => {
    render(
      <Rail label="Топ-10" isOrdered itemSize="tile">
        <RailItem>Перший</RailItem>
        <RailItem>Другий</RailItem>
      </Rail>,
    );

    const list = screen.getByRole('list', { name: 'Топ-10' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.className).toContain('--rail-columns:8');
  });
});

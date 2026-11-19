import { fireEvent, render, screen } from '@testing-library/react';
import { TitleSwitch } from './title-switch';

const options = [
  { id: 'show', label: 'Серіали', href: '/calendar' },
  { id: 'movie', label: 'Фільми', href: '/calendar?type=movie' },
] as const;

describe('TitleSwitch', () => {
  it('marks the current option and keeps real links', () => {
    render(<TitleSwitch label="Тип" options={options} value="show" onSelect={jest.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Тип' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Серіали' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Фільми' })).toHaveAttribute(
      'href',
      '/calendar?type=movie',
    );
  });

  it('selects another option in place on a plain click', () => {
    const onSelect = jest.fn();
    render(<TitleSwitch label="Тип" options={options} value="show" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('link', { name: 'Фільми' }));
    fireEvent.click(screen.getByRole('link', { name: 'Серіали' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('movie');
  });

  it('leaves modified clicks to the browser', () => {
    const onSelect = jest.fn();
    render(<TitleSwitch label="Тип" options={options} value="show" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('link', { name: 'Фільми' }), { metaKey: true });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

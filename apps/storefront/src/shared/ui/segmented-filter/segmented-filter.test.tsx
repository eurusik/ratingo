import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedFilter } from './segmented-filter';

const OPTIONS = [
  { id: 'all', label: 'Усе' },
  { id: 'show', label: 'Серіали' },
  { id: 'movie', label: 'Фільми' },
] as const;

type ContentType = (typeof OPTIONS)[number]['id'];

function ControlledFilter({ onChange }: { onChange: (value: ContentType) => void }) {
  const [value, setValue] = useState<ContentType>('all');
  return (
    <SegmentedFilter
      label="Тип"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function selectionOf(name: string) {
  const option = screen.getByRole('radio', { name });
  return option.getAttribute('aria-checked');
}

describe('SegmentedFilter', () => {
  it('renders a labelled single-choice group with the current value checked', () => {
    render(<ControlledFilter onChange={jest.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Тип' })).toBeInTheDocument();
    expect(selectionOf('Усе')).toBe('true');
    expect(selectionOf('Фільми')).toBe('false');
  });

  it('switches to the pressed option', () => {
    const onChange = jest.fn();
    render(<ControlledFilter onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Фільми' }));

    expect(onChange).toHaveBeenCalledWith('movie');
    expect(selectionOf('Фільми')).toBe('true');
    expect(selectionOf('Усе')).toBe('false');
  });

  it('keeps the current option when it is pressed again', () => {
    const onChange = jest.fn();
    render(<ControlledFilter onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Усе' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(selectionOf('Усе')).toBe('true');
  });
});

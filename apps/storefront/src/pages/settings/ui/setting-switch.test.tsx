import { render, screen } from '@testing-library/react';
import { SettingSwitch } from './setting-switch';

describe('SettingSwitch', () => {
  it('keeps the switch, label and hint inside the pressable area', () => {
    const { container } = render(
      <SettingSwitch label="Стежити" hint="Підказка" isSelected={false} onChange={jest.fn()} />,
    );
    const pressable = container.querySelector('[data-slot="switch-content"]');

    expect(pressable?.querySelector('[data-slot="switch-control"]')).not.toBeNull();
    expect(pressable).toContainElement(screen.getByText('Стежити'));
    expect(pressable).toContainElement(screen.getByText('Підказка'));
    expect(screen.getByRole('switch', { name: 'Стежити' })).toHaveAccessibleDescription('Підказка');
  });
});

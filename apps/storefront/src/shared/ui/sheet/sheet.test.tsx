import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '@heroui/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { Sheet } from './sheet';

const uk = getDictionary('uk');

function renderSheet(footer?: string) {
  return render(
    <I18nProvider locale="uk" dictionary={uk}>
      <Sheet trigger={<Button>Фільтри</Button>} title="Фільтри" footer={footer}>
        <p>Жанри</p>
      </Sheet>
    </I18nProvider>,
  );
}

describe('Sheet', () => {
  it('opens a labelled dialog from the trigger', async () => {
    renderSheet();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Фільтри' }));

    const dialog = await screen.findByRole('dialog', { name: 'Фільтри' });
    expect(dialog).toHaveTextContent('Жанри');
  });

  it('closes with the localized close button', async () => {
    renderSheet('Застосувати');
    fireEvent.click(screen.getByRole('button', { name: 'Фільтри' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Застосувати');

    fireEvent.click(screen.getByRole('button', { name: uk.common.close }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

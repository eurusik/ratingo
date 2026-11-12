import { act, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@heroui/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ResponsiveDialog } from './responsive-dialog';

const uk = getDictionary('uk');

function mockViewport({ isDesktop }: { isDesktop: boolean }) {
  jest.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: isDesktop && query.includes('min-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

async function openDialog() {
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <ResponsiveDialog trigger={<Button>Пошук</Button>} title="Пошук">
        <p>Результати</p>
      </ResponsiveDialog>
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Пошук' }));
  return screen.findByRole('dialog', { name: 'Пошук' });
}

describe('ResponsiveDialog', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens a bottom sheet below the md breakpoint', async () => {
    mockViewport({ isDesktop: false });

    const dialog = await openDialog();

    expect(dialog).toHaveClass('sheet__dialog');
    expect(screen.getByRole('button', { name: uk.common.close })).toBeInTheDocument();
  });

  it('opens a modal on desktop', async () => {
    mockViewport({ isDesktop: true });

    const dialog = await openDialog();

    expect(dialog).toHaveClass('modal__dialog');
    expect(dialog).toHaveTextContent('Результати');
    expect(screen.getByRole('button', { name: uk.common.close })).toBeInTheDocument();
  });

  it('stays open when the viewport crosses the breakpoint', async () => {
    const listeners = new Set<() => void>();
    let isDesktop = false;
    jest.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          get matches() {
            return isDesktop && query.includes('min-width');
          },
          media: query,
          addEventListener: (_: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
        }) as unknown as MediaQueryList,
    );

    expect(await openDialog()).toHaveClass('sheet__dialog');
    isDesktop = true;
    act(() => listeners.forEach((listener) => listener()));

    expect(await screen.findByRole('dialog', { name: 'Пошук' })).toHaveClass('modal__dialog');
  });

  it.each([
    ['phone', false],
    ['desktop', true],
  ])(
    'keeps the title for screen readers but drops the header when headerless on %s',
    async (_viewport, isDesktop) => {
      mockViewport({ isDesktop });
      render(
        <I18nProvider locale="uk" dictionary={uk}>
          <ResponsiveDialog isOpen title="Пошук" isHeaderless>
            <p>Результати</p>
          </ResponsiveDialog>
        </I18nProvider>,
      );

      expect(await screen.findByRole('dialog', { name: 'Пошук' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Пошук' }).parentElement).toHaveClass('sr-only');
      expect(screen.queryByRole('button', { name: uk.common.close })).not.toBeInTheDocument();
    },
  );
});

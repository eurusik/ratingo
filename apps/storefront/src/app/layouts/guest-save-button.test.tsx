import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useAuth } from '@ratingo/web-core/auth';
import type { SearchTitle } from '@/features/search';
import { closeAuth, useAuthRequest } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { GuestSaveButton } from './guest-save-button';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));

const uk = getDictionary('uk');
const ANDOR: SearchTitle = {
  key: 'andor',
  isInCatalog: true,
  type: 'show',
  slug: 'andor',
  title: 'Андор',
};

const onSave = jest.fn();

function renderButton(isAuthenticated: boolean, title = ANDOR) {
  jest.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <GuestSaveButton title={title} onSave={onSave} />
    </I18nProvider>,
  );
}

describe('GuestSaveButton', () => {
  afterEach(() => {
    act(() => closeAuth());
    onSave.mockClear();
  });

  it('asks a guest to sign in to save the title', () => {
    const { result } = renderHook(() => useAuthRequest());
    renderButton(false);

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти «Андор»' }));

    expect(result.current).toMatchObject({ intent: { kind: 'save', title: 'Андор' } });
    expect(onSave).not.toHaveBeenCalled();

    act(() => result.current?.onSignedIn?.());
    expect(onSave).toHaveBeenCalledWith(ANDOR);
  });

  it('leaves the slot to the real save button once signed in', () => {
    renderButton(true);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('skips titles that are not in the catalog yet', () => {
    renderButton(false, { ...ANDOR, isInCatalog: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

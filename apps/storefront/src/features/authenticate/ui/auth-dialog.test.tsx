import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, ErrorCode } from '@ratingo/web-core/api';
import { authApi, useAuth } from '@ratingo/web-core/auth';
import { closeAuth, openAuth } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { AuthDialog } from './auth-dialog';

jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: jest.fn(),
  authApi: { getAuthConfig: jest.fn() },
}));

const uk = getDictionary('uk');
const login = jest.fn();
const register = jest.fn();

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <AuthDialog />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false, selector: 'input' }), {
    target: { value },
  });
}

describe('AuthDialog', () => {
  beforeEach(() => {
    jest
      .mocked(useAuth)
      .mockReturnValue({ login, register } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(authApi.getAuthConfig).mockResolvedValue({
      google: { enabled: true },
      facebook: { enabled: false },
    });
  });

  afterEach(() => {
    act(() => closeAuth());
    jest.clearAllMocks();
  });

  it('names the title a guest wanted to save and offers only enabled providers first', async () => {
    window.history.replaceState(null, '', '/browse?type=show');
    renderDialog();
    act(() => openAuth({ intent: { kind: 'save', title: 'Андор' } }));

    const dialog = await screen.findByRole('dialog', { name: 'Увійди, щоб зберегти «Андор»' });
    const google = await within(dialog).findByRole('link', { name: uk.auth.continueWith.google });
    expect(google.getAttribute('href')).toContain('/auth/google?returnTo=%2Fbrowse%3Ftype%3Dshow');
    expect(
      within(dialog).queryByRole('link', { name: uk.auth.continueWith.facebook }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(uk.auth.email, { selector: 'input' })).toHaveAttribute(
      'autocomplete',
      'username',
    );
    expect(within(dialog).getByLabelText(uk.auth.password, { selector: 'input' })).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('shows one error banner when the credentials are wrong', async () => {
    login.mockRejectedValue(new ApiError(ErrorCode.UNAUTHORIZED, 401, 'Unauthorized'));
    renderDialog();
    act(() => openAuth());
    await screen.findByRole('dialog', { name: uk.auth.loginTitle });

    type(uk.auth.email, 'ivan@example.com');
    type(uk.auth.password, 'wrong');
    fireEvent.click(screen.getByRole('button', { name: uk.auth.submitLogin }));

    expect(await screen.findByRole('alert')).toHaveTextContent(uk.auth.errors.invalidCredentials);
    expect(login).toHaveBeenCalledWith({ email: 'ivan@example.com', password: 'wrong' });
  });

  it('closes and replays the guest action after signing in', async () => {
    login.mockResolvedValue(undefined);
    const replay = jest.fn();
    renderDialog();
    act(() => openAuth({ onSignedIn: replay }));
    await screen.findByRole('dialog', { name: uk.auth.loginTitle });

    type(uk.auth.email, 'ivan@example.com');
    type(uk.auth.password, 'S3curePassw0rd');
    fireEvent.click(screen.getByRole('button', { name: uk.auth.submitLogin }));

    await waitFor(() => expect(replay).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('suggests a username, checks the password live and points a taken email to sign-in', async () => {
    register.mockRejectedValue(new ApiError(ErrorCode.EMAIL_ALREADY_EXISTS, 409, 'Exists'));
    renderDialog();
    act(() => openAuth({ mode: 'register' }));
    const dialog = await screen.findByRole('dialog', { name: uk.auth.registerTitle });

    type(uk.auth.email, 'iv');
    expect(within(dialog).getByLabelText(uk.auth.username, { selector: 'input' })).toHaveValue('');
    type(uk.auth.email, 'ivan_42@example.com');
    expect(within(dialog).getByLabelText(uk.auth.username, { selector: 'input' })).toHaveValue(
      'ivan_42',
    );

    type(uk.auth.password, 'Abcdefgh');
    const rules = within(dialog).getByRole('list', { name: uk.auth.passwordRules.label });
    expect(within(rules).getByText(uk.auth.passwordRules.case).closest('li')).toHaveAttribute(
      'data-met',
      'true',
    );
    expect(within(rules).getByText(uk.auth.passwordRules.digit).closest('li')).toHaveAttribute(
      'data-met',
      'false',
    );
    expect(within(dialog).queryByLabelText(/підтверд/i)).not.toBeInTheDocument();

    type(uk.auth.password, 'Abcdefg1');
    fireEvent.click(within(dialog).getByRole('button', { name: uk.auth.submitRegister }));

    expect(await within(dialog).findByText(uk.auth.emailTaken)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: uk.auth.signInInstead }));
    expect(await screen.findByRole('button', { name: uk.auth.submitLogin })).toBeInTheDocument();
  });
});

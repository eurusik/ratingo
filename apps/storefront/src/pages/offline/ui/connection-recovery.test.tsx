import { act, render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ConnectionRecovery } from './connection-recovery';

const uk = getDictionary('uk');
const reloadPage = jest.fn();

function setBrowserState({ online, historyLength }: { online: boolean; historyLength: number }) {
  jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
  jest.spyOn(window.history, 'length', 'get').mockReturnValue(historyLength);
}

function renderRecovery() {
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <ConnectionRecovery />
    </I18nProvider>,
  );
}

const reloadButton = () => screen.getByRole('button', { name: uk.offline.reload, hidden: true });

describe('ConnectionRecovery', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadPage },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    reloadPage.mockReset();
  });

  it('explains the outage and offers to reload or go back', () => {
    setBrowserState({ online: false, historyLength: 3 });
    renderRecovery();

    expect(screen.getByRole('heading', { name: uk.offline.title })).toBeInTheDocument();
    expect(reloadButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.offline.back })).toBeInTheDocument();
  });

  it('hides the back button when there is nowhere to go back to', () => {
    setBrowserState({ online: false, historyLength: 1 });
    renderRecovery();

    expect(screen.queryByRole('button', { name: uk.offline.back })).not.toBeInTheDocument();
  });

  it('keeps reload available when the request failed although the device reports online', () => {
    setBrowserState({ online: true, historyLength: 1 });
    renderRecovery();

    expect(screen.getByRole('heading', { name: uk.offline.title })).toBeInTheDocument();
    expect(reloadButton().closest('[inert]')).toBeNull();
  });

  it('announces the restored connection and reloads the page', () => {
    setBrowserState({ online: false, historyLength: 1 });
    renderRecovery();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByRole('status')).toHaveTextContent(uk.offline.restoredDescription);
    expect(reloadButton().closest('[inert]')).not.toBeNull();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});

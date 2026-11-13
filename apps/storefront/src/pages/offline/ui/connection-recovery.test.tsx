import { act, render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ConnectionRecovery } from './connection-recovery';

const uk = getDictionary('uk');

function setConnection(online: boolean) {
  jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
}

function setHistoryLength(length: number) {
  jest.spyOn(window.history, 'length', 'get').mockReturnValue(length);
}

function renderRecovery() {
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <ConnectionRecovery />
    </I18nProvider>,
  );
}

describe('ConnectionRecovery', () => {
  afterEach(() => jest.restoreAllMocks());

  it('explains the outage and offers to reload or go back', () => {
    setConnection(false);
    setHistoryLength(3);
    renderRecovery();

    expect(screen.getByRole('heading', { name: uk.offline.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.offline.reload })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.offline.back })).toBeInTheDocument();
  });

  it('hides the back button when there is nowhere to go back to', () => {
    setConnection(false);
    setHistoryLength(1);
    renderRecovery();

    expect(screen.queryByRole('button', { name: uk.offline.back })).not.toBeInTheDocument();
  });

  it('announces the restored connection without moving the layout', () => {
    setConnection(false);
    setHistoryLength(1);
    renderRecovery();

    setConnection(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByRole('status')).toHaveTextContent(uk.offline.restoredTitle);
    expect(screen.getByRole('button', { name: uk.offline.reload, hidden: true }).closest('[inert]')).not.toBeNull();
  });
});

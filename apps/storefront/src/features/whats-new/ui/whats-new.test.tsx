import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { WHATS_NEW_STORAGE_KEY } from '../config/whats-new';
import { WhatsNew } from './whats-new';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

let settleDelayMs = 0;
jest.mock('../config/whats-new', () => ({
  ...jest.requireActual('../config/whats-new'),
  get WHATS_NEW_SETTLE_DELAY_MS() {
    return settleDelayMs;
  },
}));

const uk = getDictionary('uk');
const IPHONE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function renderWhatsNew() {
  return render(
    <I18nProvider locale="uk" dictionary={uk}>
      <WhatsNew />
    </I18nProvider>,
  );
}

function rememberOldWebClient() {
  localStorage.setItem('ratingo_refresh_token', 'old-session');
}

const findWindow = () => screen.findByRole('dialog', { name: uk.whatsNew.title }, { timeout: 3000 });

async function expectNoWindow() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}

const originalMatchMedia = window.matchMedia;

function matchOnly(matchingQuery: string) {
  window.matchMedia = ((query: string) => ({
    ...originalMatchMedia(query),
    matches: query === matchingQuery,
  })) as typeof window.matchMedia;
}

describe('WhatsNew', () => {
  beforeEach(() => {
    localStorage.clear();
    pathname = '/';
    settleDelayMs = 0;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('greets a returning user on the home page with focus on the button', async () => {
    rememberOldWebClient();
    renderWhatsNew();

    const dialog = await findWindow();
    expect(dialog.textContent).toContain(uk.whatsNew.highlights.following.title);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: uk.whatsNew.gotIt })).toHaveFocus(),
    );
  });

  it('greets a returning user on «Моє»', async () => {
    rememberOldWebClient();
    pathname = '/my';
    renderWhatsNew();

    expect(await findWindow()).toBeInTheDocument();
  });

  it('leaves new users alone', async () => {
    renderWhatsNew();

    await expectNoWindow();
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('seen');
  });

  it('does not interrupt a title page opened from a link', async () => {
    rememberOldWebClient();
    pathname = '/shows/the-bear';
    renderWhatsNew();

    await expectNoWindow();
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('due');
  });

  it('lets the page settle before opening, even on a fresh mount', async () => {
    rememberOldWebClient();
    settleDelayMs = 60_000;
    renderWhatsNew();

    await expectNoWindow();
  });

  it('waits until another overlay closes', async () => {
    rememberOldWebClient();
    const toast = document.createElement('div');
    toast.className = 'toast';
    document.body.append(toast);
    renderWhatsNew();

    await expectNoWindow();
    act(() => toast.remove());

    expect(await findWindow()).toBeInTheDocument();
  });

  it('never shows again after «Зрозуміло»', async () => {
    rememberOldWebClient();
    const { unmount } = renderWhatsNew();
    await findWindow();

    fireEvent.click(screen.getByRole('button', { name: uk.whatsNew.gotIt }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('seen');
    unmount();
    renderWhatsNew();
    await expectNoWindow();
  });

  it('counts Escape as dismissal', async () => {
    rememberOldWebClient();
    renderWhatsNew();
    const dialog = await findWindow();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('seen'));
  });

  it('closes the desktop window with its close button', async () => {
    matchOnly(DESKTOP_MEDIA_QUERY);
    rememberOldWebClient();
    renderWhatsNew();
    await findWindow();

    fireEvent.click(screen.getByRole('button', { name: uk.common.close }));

    await waitFor(() => expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('seen'));
  });

  describe('home screen icon hint', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
    });

    it('explains how to refresh the icon inside the installed iPhone app', async () => {
      Object.defineProperty(navigator, 'userAgent', { value: IPHONE_USER_AGENT, configurable: true });
      matchOnly('(display-mode: standalone)');
      rememberOldWebClient();
      renderWhatsNew();

      expect((await findWindow()).textContent).toContain(uk.whatsNew.iosIconHint);
    });

    it('stays quiet in a browser tab', async () => {
      Object.defineProperty(navigator, 'userAgent', { value: IPHONE_USER_AGENT, configurable: true });
      rememberOldWebClient();
      renderWhatsNew();

      expect((await findWindow()).textContent).not.toContain(uk.whatsNew.iosIconHint);
    });
  });
});

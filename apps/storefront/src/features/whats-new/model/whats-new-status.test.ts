import { WHATS_NEW_STORAGE_KEY } from '../config/whats-new';
import { hasWebClientData, settleWhatsNewStatus } from './whats-new-status';

describe('hasWebClientData', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    'ratingo_access_token',
    'ratingo_refresh_token',
    'ratingo:dismissed-announcements-v2',
    'ratingo:calendar-mode',
    'ratingo:sync-queued:the-bear',
  ])('recognises the old web client by %s', (key) => {
    localStorage.setItem(key, 'x');

    expect(hasWebClientData(localStorage)).toBe(true);
  });

  it('ignores keys only the storefront writes', () => {
    localStorage.setItem('ratingo:recent-titles:v1', '[]');
    localStorage.setItem('ratingo:last-import', '{}');

    expect(hasWebClientData(localStorage)).toBe(false);
  });
});

describe('settleWhatsNewStatus', () => {
  beforeEach(() => localStorage.clear());

  it('marks a browser with old web client data as due and remembers it', () => {
    localStorage.setItem('ratingo:calendar-mode', 'week');

    expect(settleWhatsNewStatus(localStorage)).toBe('due');
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('due');
  });

  it('never offers the window to a browser that starts on the new storefront', () => {
    expect(settleWhatsNewStatus(localStorage)).toBe('seen');
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe('seen');
  });

  it('keeps the first decision after the storefront signs a new user in', () => {
    settleWhatsNewStatus(localStorage);
    localStorage.setItem('ratingo_access_token', 'new-session');

    expect(settleWhatsNewStatus(localStorage)).toBe('seen');
  });

  it('stays due until dismissed even when the old data is gone', () => {
    localStorage.setItem('ratingo_refresh_token', 'old-session');
    settleWhatsNewStatus(localStorage);
    localStorage.removeItem('ratingo_refresh_token');

    expect(settleWhatsNewStatus(localStorage)).toBe('due');
  });
});

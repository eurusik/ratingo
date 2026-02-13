import { test, expect, type Page } from '@playwright/test';
import { API_URL, SUBSCRIBE_TEST_SHOW_SLUG } from '../../fixtures/test-data';

/**
 * Tests the real notification flow: watch episode → auto-subscribe → subscription exists.
 * Uses direct API calls with Bearer auth extracted from localStorage.
 */

/** Reads access token from localStorage (injected by auth setup). */
async function getAuthHeaders(page: Page) {
  await page.goto('/');
  const token = await page.evaluate(() =>
    localStorage.getItem('ratingo_access_token'),
  );
  return { Authorization: `Bearer ${token}` };
}

test.describe('Notifications — Subscription Flow', () => {
  test('watching an episode auto-subscribes to show notifications', async ({
    page,
    request,
  }) => {
    const headers = await getAuthHeaders(page);

    // 1. Get show details to find an episode ID
    const showRes = await request.get(
      `${API_URL}/catalog/shows/${SUBSCRIBE_TEST_SHOW_SLUG}`,
      { headers },
    );
    expect(showRes.ok()).toBe(true);
    const show = (await showRes.json()).data;

    const season = show.seasons?.find(
      (s: { episodes?: { id: string }[] }) =>
        s.episodes && s.episodes.length > 0,
    );
    expect(season).toBeTruthy();
    const episodeId = season.episodes[0].id;
    const showMediaItemId = show.id;

    // 2. Check subscription status before
    const statusBefore = await request.get(
      `${API_URL}/me/subscriptions/${showMediaItemId}/status`,
      { headers },
    );
    expect(statusBefore.ok()).toBe(true);
    const before = (await statusBefore.json()).data;
    const hadNewSeason = before.hasNewSeason;
    const hadNewEpisode = before.triggers?.includes('new_episode');

    // 3. Mark episode as watched (triggers auto-subscribe)
    const watchRes = await request.post(
      `${API_URL}/user-media/episodes/${episodeId}/watch`,
      { headers },
    );
    expect(watchRes.ok()).toBe(true);

    // 4. Verify subscriptions were created
    const statusAfter = await request.get(
      `${API_URL}/me/subscriptions/${showMediaItemId}/status`,
      { headers },
    );
    expect(statusAfter.ok()).toBe(true);
    const after = (await statusAfter.json()).data;

    expect(after.hasNewSeason).toBe(true);
    expect(after.triggers).toContain('new_season');
    expect(after.triggers).toContain('new_episode');

    // 5. Clean up: unwatch episode and remove subscriptions
    await request.delete(
      `${API_URL}/user-media/episodes/${episodeId}/watch`,
      { headers },
    );
    if (!hadNewSeason) {
      await request.delete(
        `${API_URL}/me/subscriptions/${showMediaItemId}`,
        { headers, data: { trigger: 'new_season' } },
      );
    }
    if (!hadNewEpisode) {
      await request.delete(
        `${API_URL}/me/subscriptions/${showMediaItemId}`,
        { headers, data: { trigger: 'new_episode' } },
      );
    }
  });

  test('subscription status returns active triggers for seeded show', async ({
    page,
    request,
  }) => {
    const headers = await getAuthHeaders(page);

    const listRes = await request.get(
      `${API_URL}/me/subscriptions?limit=1`,
      { headers },
    );
    expect(listRes.ok()).toBe(true);

    const listBody = await listRes.json();
    const items = listBody.data?.data ?? listBody.data ?? [];

    if (items.length > 0) {
      const mediaItemId = items[0].mediaItemId;

      const statusRes = await request.get(
        `${API_URL}/me/subscriptions/${mediaItemId}/status`,
        { headers },
      );
      expect(statusRes.ok()).toBe(true);
      const status = (await statusRes.json()).data;

      expect(status.triggers).toBeDefined();
      expect(Array.isArray(status.triggers)).toBe(true);
      expect(status.triggers.length).toBeGreaterThan(0);
    }
  });

  test('notifications API returns seeded notifications', async ({
    page,
    request,
  }) => {
    const headers = await getAuthHeaders(page);

    const res = await request.get(`${API_URL}/me/notifications`, { headers });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const data = body.data;

    expect(data.data.length).toBeGreaterThan(0);

    const first = data.data[0];
    expect(first.trigger).toBeDefined();
    expect(first.mediaSummary).toBeDefined();
    expect(first.mediaSummary.title).toBeTruthy();
    expect(first.mediaSummary.slug).toBeTruthy();
    expect(first.createdAt).toBeTruthy();
    expect(typeof first.isRead).toBe('boolean');
  });
});

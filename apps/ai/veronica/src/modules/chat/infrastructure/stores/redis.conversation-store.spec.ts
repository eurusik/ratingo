import { RedisConversationStore } from './redis.conversation-store';

class FakeRedis {
  readonly lists = new Map<string, string[]>();
  readonly expiries = new Map<string, number>();

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    return list.slice(
      start < 0 ? Math.max(0, list.length + start) : start,
      stop === -1 ? undefined : stop + 1,
    );
  }

  multi() {
    const steps: (() => void)[] = [];
    const chain = {
      rpush: (key: string, ...values: string[]) => {
        steps.push(() => this.lists.set(key, [...(this.lists.get(key) ?? []), ...values]));
        return chain;
      },
      ltrim: (key: string, start: number) => {
        steps.push(() => this.lists.set(key, (this.lists.get(key) ?? []).slice(start)));
        return chain;
      },
      expire: (key: string, seconds: number) => {
        steps.push(() => void this.expiries.set(key, seconds));
        return chain;
      },
      exec: async () => void steps.forEach((step) => step()),
    };
    return chain;
  }
}

const storeOn = (redis: FakeRedis) => new RedisConversationStore(redis as never);

describe('RedisConversationStore', () => {
  it('returns nothing for a chat with no history', async () => {
    await expect(storeOn(new FakeRedis()).recent('10')).resolves.toEqual([]);
  });

  it('stores turns as text only and reads them back in order', async () => {
    const store = storeOn(new FakeRedis());
    await store.append('10', [
      { role: 'user', text: 'що з чергами?' },
      { role: 'assistant', text: 'Невдалих: 7.' },
    ]);
    await expect(store.recent('10')).resolves.toEqual([
      { role: 'user', text: 'що з чергами?' },
      { role: 'assistant', text: 'Невдалих: 7.' },
    ]);
  });

  it('keeps the time of a turn and drops a time that is not a number', async () => {
    const redis = new FakeRedis();
    const store = storeOn(redis);
    await store.append('10', [{ role: 'user', text: 'a', atMs: 1_700_000_000_000 }]);
    const [key] = [...redis.lists.keys()];
    redis.lists.get(key)?.push(JSON.stringify({ role: 'assistant', text: 'b', atMs: 'вчора' }));
    await expect(store.recent('10')).resolves.toEqual([
      { role: 'user', text: 'a', atMs: 1_700_000_000_000 },
      { role: 'assistant', text: 'b' },
    ]);
  });

  it('keeps only the last 12 messages and expires them after 24 hours', async () => {
    const redis = new FakeRedis();
    const store = storeOn(redis);
    for (let index = 0; index < 10; index += 1) {
      await store.append('10', [
        { role: 'user', text: `q${index}` },
        { role: 'assistant', text: `a${index}` },
      ]);
    }
    const turns = await store.recent('10');
    expect(turns).toHaveLength(12);
    expect(turns[0].text).toBe('q4');
    expect(turns[11].text).toBe('a9');
    expect(redis.expiries.get('ai-veronica:conversation:10')).toBe(86_400);
  });

  it('keeps chats apart', async () => {
    const store = storeOn(new FakeRedis());
    await store.append('10', [{ role: 'user', text: 'a' }]);
    await expect(store.recent('11')).resolves.toEqual([]);
  });

  it('clips a long message and skips a corrupt entry', async () => {
    const redis = new FakeRedis();
    const store = storeOn(redis);
    await store.append('10', [{ role: 'assistant', text: 'x'.repeat(5000) }]);
    redis.lists
      .get('ai-veronica:conversation:10')
      ?.push('not json', '{"role":"system","text":"hi"}');
    const turns = await store.recent('10');
    expect(turns).toHaveLength(1);
    expect(turns[0].text.length).toBe(1000);
  });

  it('does nothing for an empty append', async () => {
    const redis = new FakeRedis();
    await storeOn(redis).append('10', []);
    expect(redis.lists.size).toBe(0);
  });
});

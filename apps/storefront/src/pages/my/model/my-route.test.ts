import { resolveMyRoute } from './my-route';

describe('resolveMyRoute', () => {
  it('opens a main list by name', () => {
    expect(resolveMyRoute('history')).toEqual({ list: 'history' });
  });

  it('opens set-aside titles inside Watching for old paused and dropped links', () => {
    expect(resolveMyRoute('paused')).toEqual({ list: 'watching', watchingFilter: 'postponed' });
    expect(resolveMyRoute('dropped')).toEqual({ list: 'watching', watchingFilter: 'postponed' });
  });

  it('falls back to Watching for unknown or missing lists', () => {
    expect(resolveMyRoute('saved')).toEqual({ list: 'watching' });
    expect(resolveMyRoute(undefined)).toEqual({ list: 'watching' });
  });
});

import * as fc from 'fast-check';

import {
  apiOnly,
  APP_ROLES,
  type AppRole,
  DEFAULT_APP_ROLE,
  getAppRole,
  runsHttp,
  runsWorkers,
  workerOnly,
} from './app-role';

describe('app-role', () => {
  const originalRole = process.env.APP_ROLE;

  afterEach(() => {
    if (originalRole === undefined) {
      delete process.env.APP_ROLE;
    } else {
      process.env.APP_ROLE = originalRole;
    }
  });

  describe('getAppRole', () => {
    it('defaults to "all" so an unset APP_ROLE keeps the single-process deploy', () => {
      expect(DEFAULT_APP_ROLE).toBe('all');
      expect(getAppRole({})).toBe('all');
      expect(getAppRole({ APP_ROLE: '' })).toBe('all');
    });

    it.each(APP_ROLES)('accepts "%s"', (role) => {
      expect(getAppRole({ APP_ROLE: role })).toBe(role);
    });

    it('matches roles exactly, like the Dockerfile start command', () => {
      expect(() => getAppRole({ APP_ROLE: 'Worker' })).toThrow(/Invalid APP_ROLE "Worker"/);
      expect(() => getAppRole({ APP_ROLE: ' worker' })).toThrow(/Invalid APP_ROLE/);
    });

    it('rejects unknown roles', () => {
      expect(() => getAppRole({ APP_ROLE: 'scheduler' })).toThrow(/Invalid APP_ROLE "scheduler"/);
    });

    it('reads process.env by default', () => {
      process.env.APP_ROLE = 'api';
      expect(getAppRole()).toBe('api');
    });
  });

  describe('runsHttp / runsWorkers', () => {
    it.each<[AppRole, boolean, boolean]>([
      ['api', true, false],
      ['worker', false, true],
      ['all', true, true],
    ])('role "%s" runs http=%s, workers=%s', (role, http, workers) => {
      expect(runsHttp(role)).toBe(http);
      expect(runsWorkers(role)).toBe(workers);
    });

    it('every role runs at least one side', () => {
      fc.assert(
        fc.property(fc.constantFrom(...APP_ROLES), (role) => runsHttp(role) || runsWorkers(role)),
      );
    });
  });

  describe('workerOnly / apiOnly', () => {
    class Processor {}
    class Controller {}

    it.each<[AppRole, unknown[], unknown[]]>([
      ['api', [], [Controller]],
      ['worker', [Processor], []],
      ['all', [Processor], [Controller]],
    ])('role "%s" keeps the matching side', (role, workers, controllers) => {
      process.env.APP_ROLE = role;
      expect(workerOnly(Processor)).toEqual(workers);
      expect(apiOnly(Controller)).toEqual(controllers);
    });
  });
});

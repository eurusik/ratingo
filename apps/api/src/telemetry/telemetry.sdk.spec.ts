import { type IncomingMessage } from 'node:http';

import { buildServiceAttributes, isHealthCheck, startTelemetry } from './telemetry.sdk';

describe('telemetry.sdk', () => {
  describe('buildServiceAttributes', () => {
    it('names the worker role ratingo-worker and tags Railway metadata', () => {
      expect(
        buildServiceAttributes('worker', {
          RAILWAY_GIT_COMMIT_SHA: 'abcdef1234567',
          RAILWAY_ENVIRONMENT_NAME: 'production',
        }),
      ).toEqual({
        'service.name': 'ratingo-worker',
        'service.version': 'abcdef1',
        'deployment.environment.name': 'production',
        'app.role': 'worker',
      });
    });

    it('names api and all roles ratingo-api and falls back for local runs', () => {
      expect(buildServiceAttributes('all', {})).toMatchObject({
        'service.name': 'ratingo-api',
        'service.version': 'local',
        'deployment.environment.name': 'development',
      });
      expect(buildServiceAttributes('api', {})['service.name']).toBe('ratingo-api');
    });

    it('lets OTEL_SERVICE_NAME override the role-based name', () => {
      expect(buildServiceAttributes('api', { OTEL_SERVICE_NAME: 'custom' })['service.name']).toBe(
        'custom',
      );
    });
  });

  describe('isHealthCheck', () => {
    it('matches health check requests only', () => {
      expect(isHealthCheck({ url: '/api/health' } as IncomingMessage)).toBe(true);
      expect(isHealthCheck({ url: '/api/catalog/movies' } as IncomingMessage)).toBe(false);
      expect(isHealthCheck({} as IncomingMessage)).toBe(false);
    });
  });

  describe('startTelemetry', () => {
    it('does not start the SDK when telemetry is disabled', () => {
      expect(startTelemetry({})).toBeUndefined();
    });
  });
});

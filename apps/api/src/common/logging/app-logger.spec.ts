import { ConsoleLogger } from '@nestjs/common';

import { createAppLogger, getLogFormat, getLogLevels } from './app-logger';
import { JsonConsoleLogger } from './json-console.logger';

describe('app-logger', () => {
  describe('getLogFormat', () => {
    it('defaults to pretty locally and json when deployed', () => {
      expect(getLogFormat({})).toBe('pretty');
      expect(getLogFormat({ NODE_ENV: 'development' })).toBe('pretty');
      expect(getLogFormat({ NODE_ENV: 'production' })).toBe('json');
      expect(getLogFormat({ RAILWAY_ENVIRONMENT_NAME: 'dev' })).toBe('json');
    });

    it('honours an explicit LOG_FORMAT', () => {
      expect(getLogFormat({ LOG_FORMAT: 'json' })).toBe('json');
      expect(getLogFormat({ NODE_ENV: 'production', LOG_FORMAT: 'pretty' })).toBe('pretty');
    });

    it('rejects an unknown LOG_FORMAT', () => {
      expect(() => getLogFormat({ LOG_FORMAT: 'xml' })).toThrow('Invalid LOG_FORMAT "xml"');
    });
  });

  describe('getLogLevels', () => {
    it('enables every level locally', () => {
      expect(getLogLevels({})).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal']);
    });

    it('drops debug and verbose when deployed', () => {
      expect(getLogLevels({ NODE_ENV: 'production' })).toEqual(['log', 'warn', 'error', 'fatal']);
      expect(getLogLevels({ RAILWAY_ENVIRONMENT_NAME: 'production' })).toEqual([
        'log',
        'warn',
        'error',
        'fatal',
      ]);
    });

    it('treats LOG_LEVEL as the minimum level', () => {
      expect(getLogLevels({ NODE_ENV: 'production', LOG_LEVEL: 'debug' })).toEqual([
        'debug',
        'log',
        'warn',
        'error',
        'fatal',
      ]);
      expect(getLogLevels({ LOG_LEVEL: 'warn' })).toEqual(['warn', 'error', 'fatal']);
    });

    it('rejects an unknown LOG_LEVEL', () => {
      expect(() => getLogLevels({ LOG_LEVEL: 'trace' })).toThrow('Invalid LOG_LEVEL "trace"');
    });
  });

  describe('createAppLogger', () => {
    it('builds a JSON logger when deployed', () => {
      expect(createAppLogger({ NODE_ENV: 'production' })).toBeInstanceOf(JsonConsoleLogger);
    });

    it('builds the default pretty logger locally', () => {
      const logger = createAppLogger({});
      expect(logger).toBeInstanceOf(ConsoleLogger);
      expect(logger).not.toBeInstanceOf(JsonConsoleLogger);
    });
  });
});

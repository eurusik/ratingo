import { type EventEmitter2 } from '@nestjs/event-emitter';

import {
  EXTERNAL_API_FAILURE_EVENT,
  EXTERNAL_API_PROVIDER,
  emitExternalApiFailure,
  isKeyFailureStatus,
} from './external-api-failure.event';

describe('external-api-failure event', () => {
  describe('isKeyFailureStatus', () => {
    it.each([401, 403, 429])('treats %i as a key-failure status', (status) => {
      expect(isKeyFailureStatus(status)).toBe(true);
    });

    it.each([200, 404, 418, 500, 502, 503])('does not treat %i as a key failure', (status) => {
      expect(isKeyFailureStatus(status)).toBe(false);
    });
  });

  describe('emitExternalApiFailure', () => {
    let emitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

    beforeEach(() => {
      emitter = { emit: jest.fn() };
    });

    it.each([401, 403, 429])('emits the event with provider + code for %i', (status) => {
      emitExternalApiFailure(
        emitter as unknown as EventEmitter2,
        EXTERNAL_API_PROVIDER.TMDB,
        status,
      );

      expect(emitter.emit).toHaveBeenCalledWith(EXTERNAL_API_FAILURE_EVENT, {
        provider: EXTERNAL_API_PROVIDER.TMDB,
        statusCode: status,
      });
    });

    it.each([200, 404, 500])('does not emit for non-key-failure status %i', (status) => {
      emitExternalApiFailure(
        emitter as unknown as EventEmitter2,
        EXTERNAL_API_PROVIDER.TRAKT,
        status,
      );

      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });
});

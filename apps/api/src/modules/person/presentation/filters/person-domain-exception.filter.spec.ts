import { type ArgumentsHost, HttpStatus } from '@nestjs/common';

import { PersonDomainError, PersonNotFoundError } from '../../domain/errors';

import { PersonDomainExceptionFilter } from './person-domain-exception.filter';

function makeHost(): { host: ArgumentsHost; status: jest.Mock; send: jest.Mock } {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, send };
}

class UnknownPersonError extends PersonDomainError {
  readonly code = 'PERSON_UNKNOWN';
  constructor() {
    super('boom');
  }
}

describe('PersonDomainExceptionFilter', () => {
  const filter = new PersonDomainExceptionFilter();

  it('maps PersonNotFoundError to 404 with tmdbId detail', () => {
    const { host, status, send } = makeHost();

    filter.catch(new PersonNotFoundError(287), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = send.mock.calls[0][0];
    expect(body.error.code).toBe('PERSON_NOT_FOUND');
    expect(body.error.details).toMatchObject({ tmdbId: 287 });
  });

  it('maps unknown person errors to 500', () => {
    const { host, status } = makeHost();

    filter.catch(new UnknownPersonError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

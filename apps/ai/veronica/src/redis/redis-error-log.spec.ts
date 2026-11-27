import { Logger } from '@nestjs/common';

import { withRedisErrorLog } from './redis-error-log';

describe('withRedisErrorLog', () => {
  it('logs the name of the connection and the class of the error, never the message', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    let handler: (error: Error) => void = () => undefined;
    const connection = {
      on: (_event: string, listener: (error: Error) => void) => {
        handler = listener;
        return connection;
      },
    };

    const returned = withRedisErrorLog(connection as never, 'chat-queue');
    handler(new TypeError('connect ECONNREFUSED redis://user:secret@host'));

    expect(returned).toBe(connection);
    expect(warn).toHaveBeenCalledWith({
      message: 'redis.error',
      connection: 'chat-queue',
      reason: 'TypeError',
    });
    warn.mockRestore();
  });
});

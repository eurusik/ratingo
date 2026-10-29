import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NotificationListQueryDto } from './notifications.dto';

describe('NotificationListQueryDto', () => {
  // Mirrors the global ValidationPipe transformOptions in main.ts
  const toDto = (query: Record<string, unknown>) =>
    plainToInstance(NotificationListQueryDto, query, { enableImplicitConversion: true });

  it('parses ?unread=false as false (implicit conversion must not coerce it to true)', () => {
    expect(toDto({ unread: 'false' }).unread).toBe(false);
  });

  it('parses ?unread=true as true', () => {
    expect(toDto({ unread: 'true' }).unread).toBe(true);
  });

  it('keeps real booleans', () => {
    expect(toDto({ unread: true }).unread).toBe(true);
    expect(toDto({ unread: false }).unread).toBe(false);
  });

  it('treats other strings as false', () => {
    expect(toDto({ unread: '0' }).unread).toBe(false);
    expect(toDto({ unread: 'yes' }).unread).toBe(false);
  });

  it('passes validation for both values', async () => {
    expect(await validate(toDto({ unread: 'false' }))).toHaveLength(0);
    expect(await validate(toDto({ unread: 'true' }))).toHaveLength(0);
  });
});

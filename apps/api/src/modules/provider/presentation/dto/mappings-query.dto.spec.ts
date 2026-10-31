import { plainToInstance } from 'class-transformer';

import { MappingsQueryDto } from './provider.dto';

const transform = (plain: Record<string, unknown>) =>
  plainToInstance(MappingsQueryDto, plain, { enableImplicitConversion: true });

describe('MappingsQueryDto.includeGlobal', () => {
  it('parses "false" as false (not truthy-string true)', () => {
    expect(transform({ includeGlobal: 'false' }).includeGlobal).toBe(false);
  });

  it('parses "true" as true', () => {
    expect(transform({ includeGlobal: 'true' }).includeGlobal).toBe(true);
  });

  it('defaults to true when omitted', () => {
    expect(transform({}).includeGlobal).toBe(true);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const createDto = (partial: Partial<RegisterDto>): RegisterDto =>
    plainToInstance(RegisterDto, partial);

  const validData: Partial<RegisterDto> = {
    email: 'test@example.com',
    username: 'validuser',
    password: 'Password1',
  };

  it('should accept valid registration data', async () => {
    const dto = createDto(validData);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid email', async () => {
    const dto = createDto({ ...validData, email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should reject password without uppercase', async () => {
    const dto = createDto({ ...validData, password: 'password1' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject password without digit', async () => {
    const dto = createDto({ ...validData, password: 'Password' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject password shorter than 8 chars', async () => {
    const dto = createDto({ ...validData, password: 'Pass1' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject password longer than 128 chars', async () => {
    const dto = createDto({ ...validData, password: 'A'.repeat(127) + 'a1' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject username shorter than 3 chars', async () => {
    const dto = createDto({ ...validData, username: 'ab' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should reject username longer than 30 chars', async () => {
    const dto = createDto({ ...validData, username: 'a'.repeat(31) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should reject username with special chars', async () => {
    const dto = createDto({ ...validData, username: 'user@name' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should accept username with underscores', async () => {
    const dto = createDto({ ...validData, username: 'valid_user_1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

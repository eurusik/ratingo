import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  const createDto = (partial: Partial<ChangePasswordDto>): ChangePasswordDto =>
    plainToInstance(ChangePasswordDto, partial);

  it('should accept valid change-password request', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'NewPass123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject newPassword without uppercase', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'newpass123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should reject newPassword without lowercase', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'NEWPASS123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should reject newPassword without digit', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'NewPassword' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should reject newPassword shorter than 8 chars', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'New1' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should reject newPassword longer than 128 chars', async () => {
    const dto = createDto({
      currentPassword: 'OldPass123',
      newPassword: 'A'.repeat(127) + 'a1',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should reject empty currentPassword', async () => {
    const dto = createDto({ currentPassword: '', newPassword: 'NewPass123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'currentPassword')).toBe(true);
  });

  it('should reject empty newPassword', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('should accept valid passwords at boundary length (8 chars)', async () => {
    const dto = createDto({ currentPassword: 'OldPass123', newPassword: 'Abcdef1x' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

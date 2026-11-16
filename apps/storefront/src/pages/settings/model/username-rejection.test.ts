import { ApiError, ErrorCode } from '@ratingo/web-core/api';
import { usernameRejectionOf } from './username-rejection';

describe('usernameRejectionOf', () => {
  it('reads a taken username', () => {
    const error = new ApiError(ErrorCode.USERNAME_ALREADY_EXISTS, 409, 'Username already in use');
    expect(usernameRejectionOf(error)).toBe('taken');
  });

  it('reads a reserved username from the validation messages', () => {
    const message = 'username "admin" is reserved and cannot be used';
    const error = new ApiError(ErrorCode.VALIDATION_ERROR, 400, message, { errors: [message] });
    expect(usernameRejectionOf(error)).toBe('unavailable');
  });

  it('ignores validation errors about other fields', () => {
    const message = 'bio must be shorter than or equal to 200 characters';
    const error = new ApiError(ErrorCode.VALIDATION_ERROR, 400, message, { errors: [message] });
    expect(usernameRejectionOf(error)).toBeNull();
  });

  it('ignores errors that are not from the API', () => {
    expect(usernameRejectionOf(new Error('offline'))).toBeNull();
  });
});

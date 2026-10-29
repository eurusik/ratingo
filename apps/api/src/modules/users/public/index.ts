/**
 * Public API for users module.
 *
 * This is the ONLY entry point for other modules to import from users.
 */

// Validators
export { IsNotReservedUsername } from '../presentation/validators/not-reserved-username.validator';

export {
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
  USERNAME_MESSAGE,
} from '../presentation/validators/username.constants';

// Domain constants & entities
export { RESERVED_USERNAMES } from '../domain/constants/reserved-usernames';
export { USER_ROLE } from '../domain/entities/user.entity';
export type { User } from '../domain/entities/user.entity';

// Application services
export { UsersService } from '../application/users.service';

import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

import { RESERVED_USERNAMES } from '../../domain/constants/reserved-usernames';

export function IsNotReservedUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotReservedUsername',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return true;
          return !RESERVED_USERNAMES.includes(
            value.toLowerCase() as (typeof RESERVED_USERNAMES)[number],
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} "${args.value}" is reserved and cannot be used`;
        },
      },
    });
  };
}

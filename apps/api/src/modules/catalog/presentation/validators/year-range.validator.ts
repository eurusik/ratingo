import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'YearRange', async: false })
export class YearRangeConstraint implements ValidatorConstraintInterface {
  validate(yearTo: unknown, args: ValidationArguments): boolean {
    const o = args.object as { yearFrom?: number; yearTo?: number };
    if (o.yearFrom === undefined || yearTo === undefined) return true;
    return o.yearFrom <= (yearTo as number);
  }

  defaultMessage(): string {
    return 'yearFrom must be less than or equal to yearTo';
  }
}

@ValidatorConstraint({ name: 'YearExclusive', async: false })
export class YearExclusiveConstraint implements ValidatorConstraintInterface {
  validate(year: unknown, args: ValidationArguments): boolean {
    const o = args.object as { yearFrom?: number; yearTo?: number };
    if (year === undefined) return true;
    return o.yearFrom === undefined && o.yearTo === undefined;
  }

  defaultMessage(): string {
    return 'year cannot be used with yearFrom/yearTo';
  }
}

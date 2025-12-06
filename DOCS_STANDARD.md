# Ratingo API Documentation Standard

Використовуємо **TSDoc** для документування коду.

## Загальні правила

1. **Мова**: Англійська (для коду та коментарів).
2. **Стиль**: Лаконічний, імперативний (наприклад, "Gets user", а не "This function returns the user").

## Формат для класів та методів

```typescript
/**
 * Short description of functionality.
 * 
 * Detailed description if logic is complex or requires explanation of
 * side effects, heavy computations, or external calls.
 *
 * @param {Type} name - Description of the parameter
 * @returns {Type} Description of the return value
 * @throws {ErrorType} Condition when error occurs
 * 
 * @example
 * const result = await service.method(params);
 */
public async method(name: string): Promise<Result> { ... }
```

## Формат для DTO (Swagger)

Для DTO використовуємо декоратори `@ApiProperty`, а коментарі TSDoc дублюємо тільки якщо потрібні деталі для розробника, які не йдуть в API docs.

```typescript
export class CreateUserDto {
  /**
   * User's unique email address.
   * Must be valid format.
   */
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email: string;
}
```

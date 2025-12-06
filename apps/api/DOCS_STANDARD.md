# Ratingo Documentation Standard (Pragmatic)

Ми сповідуємо принцип **Code as Documentation**. Коментарі потрібні тільки там, де код не може пояснити сам себе.

## 1. Інтерфейси (Domain Layer) — ✅ Обов'язково
Інтерфейси — це контракти між модулями. Вони повинні бути добре задокументовані, щоб розробник міг використовувати модуль, не читаючи його код.

```typescript
/**
 * Відповідає за нормалізацію даних із зовнішніх джерел.
 * Всі адаптери (TMDB, Trakt) повинні реалізовувати цей інтерфейс.
 */
export interface IMetadataProvider {
  getMovie(id: number): Promise<NormalizedMedia | null>;
}
```

## 2. Реалізація (Services/Adapters) — ❌ Тільки складне
Не пишіть коментарі до очевидних методів.
*   **Погано**:
    ```typescript
    /** Gets user by ID */
    getUser(id: number) { ... }
    ```
*   **Добре** (без коментаря):
    ```typescript
    getUser(id: number) { ... }
    ```
*   **Добре** (пояснення неочевидного):
    ```typescript
    /**
     * TMDB API має ліміт 40 запитів/10сек.
     * Використовуємо leaky bucket для обмеження швидкості.
     */
    private async rateLimitedFetch(...) { ... }
    ```

## 3. DTO & Models — ✅ Декоратори
Для полів, які йдуть назовні (API), використовуємо декоратори NestJS/Swagger.

```typescript
export class CreateMovieDto {
  @ApiProperty({ description: 'Unique TMDB identifier', example: 550 })
  tmdbId: number; // Коментар TSDoc тут не потрібен
}
```

## 4. Стиль
*   Мова: **Англійська**.
*   Формат: **TSDoc** (для IDE підказок).

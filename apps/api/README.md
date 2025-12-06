# Ratingo API (Next Gen)

## Стек
*   **Framework**: NestJS + Fastify
*   **Database**: PostgreSQL + Drizzle ORM
*   **Queue**: Redis + BullMQ
*   **Docs**: Swagger (OpenAPI)

## Запуск

### 1. Змінні середовища
Створіть `.env` в `apps/api`:

```bash
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ratingo_new
REDIS_HOST=localhost
REDIS_PORT=6379
TMDB_API_KEY=your_key_here
```

### 2. Міграції БД
```bash
# Згенерувати SQL
npx drizzle-kit generate

# Накотити на базу
npx drizzle-kit migrate
```

### 3. Запуск сервера
```bash
# З кореня монорепо
npm run dev --workspace=api
```

## Архітектура

### Modules
*   **Catalog**: Власник даних (`media_items`, `movies`, `shows`).
*   **Ingestion**: Адаптери (TMDB) та Воркери синхронізації.

### API Endpoints
*   `POST /ingestion/sync`: Запустити синхронізацію фільму вручну.
*   `GET /docs`: Swagger документація.

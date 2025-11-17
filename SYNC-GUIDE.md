# SYNC GUIDE

## Що це

- Механізм швидкого наповнення бази трендовими серіалами і фільмами без довгих запитів.
- **Серіали**: працює короткими HTTP викликами — координатор ставить задачі, процесор обробляє батчами, є статус.
- **Фільми**: підтримуються координатор/процесор/статус як у серіалах, а також повний синк за один виклик.

## Для чого

- Щоб уникнути таймаутів і "вмерлих" довгих процесів для серіалів (батчі) та швидко заповнити фільми (повний синк).

## Підготовка локально

- Встанови `DATABASE_URL` і `CRON_SECRET` у `.env`.
- Запусти `npm run dev`.

## Як користуватись

### Серіали

**Поставити задачі (координатор):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending
```

**Обробити батч задач (процесор):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/sync/trending/process?limit=10"
```

**Перевірити прогрес (статус):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending/status
```

**Довгі етапи — окремо:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/omdb
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/meta
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/sync
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/prune
```

### Фільми

**Поставити задачі (координатор):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/movies/trending
```

**Обробити батч задач (процесор):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/sync/movies/trending/process?limit=10"
```

**Перевірити прогрес (статус):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/movies/trending/status
```

#### Повний синк трендів (рекомендовано)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/movies/trending/full
```

**Що робить:**

1. **Trakt API**: Завантажує топ-100 трендових фільмів з актуальними показниками популярності
2. **TMDB Enrichment**: Збагачує кожен фільм:
   - Постери (2/3 aspect ratio) та backdrop зображення
   - Офіційні трейлери з YouTube
   - Топ-10 акторів та їх ролі
   - Українські та оригінальні назви/описи
3. **Рейтинги**: Агрегує з 4 джерел:
   - TMDB (vote_average)
   - IMDb (через OMDb API)
   - Trakt (user ratings)
   - Metacritic (critics score)
4. **Popularity Snapshots**: Створює спарклайни (30 днів історії)
5. **Watch Providers**: Додає легальні платформи для UA та US
6. **Content Ratings**: Вікові обмеження (G, PG, PG-13, R, NC-17)

**Очікуваний результат:**

```json
{
  "success": true,
  "totals": {
    "trendingFetched": 100, // Завантажено з Trakt
    "updated": 85, // Оновлено існуючих
    "added": 15 // Додано нових
  },
  "ratings": {
    "tmdb": 95, // Фільмів з TMDB рейтингом
    "imdb": 88, // Фільмів з IMDb рейтингом
    "trakt": 100 // Фільмів з Trakt рейтингом
  },
  "snapshots": 100, // Спарклайнів створено
  "providers": 200, // Watch providers додано (UA+US)
  "cast": 850, // Записів акторів (10/фільм)
  "trailers": 92 // Трейлерів знайдено
}
```

**Час виконання:** ~2-3 хвилини для 100 фільмів

**Частота запуску:**

- Production (cron): щоденно о 02:00 UTC
- Manual: за потреби (нові тренди, оновлення метаданих)

## Очікування

**Серіали:**

- Координатор — `success: true`, `tasksQueued: 100`
- Процесор — `processed/succeeded/failed`
- Статус — `pending/processing/done/error`

**Фільми:**

- Координатор — `success: true`, `tasksQueued: 100`
- Процесор — `processed/succeeded/failed`
- Статус — `pending/processing/done/error`
- Повний синк — `success: true`, `totals.trendingFetched: 100`
- Лічильники: `updated` (оновлені), `added` (нові)
- Статистика рейтингів: `tmdb/imdb/trakt` (кількість фільмів з рейтингом)
- Метадані: `snapshots` (спарклайни), `providers` (платформи), `cast` (актори), `trailers` (трейлери)

## Поради

- **Серіали**: тримай `limit` невеликим (10–20) і викликай процесор кілька разів.
- **Фільми**: синк працює одним запитом, але може зайняти 2-3 хвилини для 100 фільмів.
- Завжди додавай заголовок `Authorization: Bearer $CRON_SECRET`.
- Для production використовуй `https://ratingo.top` замість `localhost:3000`.

## Де в коді

**Серіали:**

- Координатор: `app/api/sync/trending/route.ts:11` → `lib/sync/trendingCoordinator.ts:7`
- Процесор: `app/api/sync/trending/process/route.ts:13` → `lib/sync/trendingProcessor.ts:8`
- Статус: `app/api/sync/trending/status/route.ts:12`

**Фільми:**

- Координатор: `app/api/sync/movies/trending/route.ts:1` → `lib/sync/trendingMoviesCoordinator.ts:1`
- Процесор: `app/api/sync/movies/trending/process/route.ts:1` → `lib/sync/trendingMoviesProcessor.ts:1`
- Статус: `app/api/sync/movies/trending/status/route.ts:1`
- Повний синк: `app/api/sync/movies/trending/full/route.ts:1` → `lib/sync/trendingMovies.ts:1`

## Повний бутстрап (одноразово для порожньої БД)

### Серіали — повний синк

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ratingo.top/api/sync/trending/full
```

**Що робить:**

- Створює/оновлює `shows`
- Рейтинги та спарклайни
- OMDb/meta бекфіли
- Календар ефірів

**Коли використовувати:**

- Одноразово для старту
- Ручний catch‑up
- ⚠️ Не запускати часто — ендпоїнт ресурсомісткий

### Фільми — повний синк трендів

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ratingo.top/api/sync/movies/trending/full
```

**Що робить (детально):**

1. **Movies Table**: Створює/оновлює записи фільмів з TMDB та Trakt ID
2. **Ratings**: Зберігає всі доступні рейтинги (TMDB, IMDb, Trakt, Metacritic)
3. **Snapshots**: Створює щоденні знімки популярності для графіків
4. **OMDb Enrichment**: Додає IMDb рейтинги та Metacritic scores
5. **Watch Providers**: Платформи для перегляду (Netflix, Disney+, Amazon тощо) для UA та US
6. **Trailers**: Офіційні трейлери з YouTube
7. **Cast**: Топ-10 акторів з ролями та фото

**Коли використовувати:**

- ✅ **Щоденно**: автоматично через cron (о 02:00 UTC)
- ✅ **Після релізів**: коли з'являються нові великі прем'єри
- ✅ **Оновлення метаданих**: якщо змінилися постери, описи, каст
- ✅ **Нові регіони**: після додавання підтримки нових країн
- ⚠️ **Не частіше 1 разу на годину**: щоб не перевантажувати API

**API Limits:**

- TMDB: 40 requests/10 seconds
- OMDb: 1000 requests/day
- Trakt: обмежень немає (з API ключем)

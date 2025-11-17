# SYNC GUIDE

Що це

- Механізм швидкого наповнення бази трендовими серіалами і фільмами без довгих запитів.
- Серіали: працює короткими HTTP викликами — координатор ставить задачі, процесор обробляє батчами, є статус.
- Фільми: доступний повний синк трендів за один виклик.

Для чого

- Щоб уникнути таймаутів і “вмерлих” довгих процесів для серіалів (батчі) та швидко заповнити фільми (повний синк).

Підготовка локально

- Встанови `DATABASE_URL` і `CRON_SECRET` у `.env`.
- Запусти `npm run dev`.

Як користуватись

- Серіали — поставити задачі (координатор):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending
```

- Серіали — обробити батч задач (процесор):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/sync/trending/process?limit=10"
```

- Серіали — перевірити прогрес (статус):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending/status
```

- Серіали — довгі етапи — окремо:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/omdb
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/meta
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/sync
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/prune
```

Очікування

- Серіали: координатор — `success: true`, `tasksQueued: 100`; процесор — `processed/succeeded/failed`; статус — `pending/processing/done/error`.
- Фільми: повний синк — `success: true`, `totals.trendingFetched: N`, лічильники `updated/added` та статистика `ratings/snapshots`.

Поради

- Серіали: тримай `limit` невеликим (10–20) і викликай процесор кілька разів.
- Завжди додавай заголовок `Authorization: Bearer $CRON_SECRET`.

Де в коді

- Серіали:
  - Координатор: `app/api/sync/trending/route.ts:11` → `lib/sync/trendingCoordinator.ts:7`
  - Процесор: `app/api/sync/trending/process/route.ts:13` → `lib/sync/trendingProcessor.ts:8`
  - Статус: `app/api/sync/trending/status/route.ts:12`
- Фільми:
  - Повний синк: `app/api/sync/movies/trending/full/route.ts:1` → `lib/sync/trendingMovies.ts:1`

Повний бутстрап (одноразово для порожньої БД)

- Серіали — запустити повний синк трендів одним викликом:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ratingo.top/api/sync/trending/full
```

- Що робить (серіали): створює/оновлює `shows`, рейтинги, спарклайни, OMDb/meta бекфіли, календар ефірів.
- Коли використовувати: одноразово для старту, або як ручний catch‑up. Не запускати часто — ендпоїнт ресурсомісткий.

Фільми — повний синк трендів:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ratingo.top/api/sync/movies/trending/full
```

- Що робить (фільми): створює/оновлює `movies`, рейтинги та дистрибуцію (Trakt), спарклайни переглядів, OMDb агрегати, провайдери, трейлери та каст.

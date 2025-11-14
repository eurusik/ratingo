# SYNC GUIDE

Що це
- Механізм швидкого наповнення бази трендовими шоу без довгих запитів.
- Працює короткими HTTP викликами: координатор ставить задачі, процесор обробляє батчами, є статус.

Для чого
- Щоб уникнути таймаутів і “вмерлих” довгих процесів. Усе розбито на короткі кроки.

Підготовка локально
- Встанови `DATABASE_URL` і `CRON_SECRET` у `.env`.
- Запусти `npm run dev`.

Як користуватись
- Поставити задачі (координатор):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending
```
- Обробити батч задач (процесор):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/sync/trending/process?limit=10"
```
- Перевірити прогрес (статус):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/trending/status
```
- Довгі етапи — окремо:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/omdb
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/backfill/meta
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/sync
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/calendar/prune
```

Очікування
- Координатор: `success: true`, `tasksQueued: 100`.
- Процесор: `processed`, `succeeded`, `failed`.
- Статус: лічильники `pending/processing/done/error`. Коли `pending=0` — черга виконана.

Поради
- Тримай `limit` невеликим (10–20) і викликай процесор кілька разів.
- Завжди додавай заголовок `Authorization: Bearer $CRON_SECRET`.

Де в коді
- Координатор: `app/api/sync/trending/route.ts:11` → `lib/sync/trendingCoordinator.ts:7`
- Процесор: `app/api/sync/trending/process/route.ts:13` → `lib/sync/trendingProcessor.ts:8`
- Статус: `app/api/sync/trending/status/route.ts:12`
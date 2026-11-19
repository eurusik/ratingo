<div align="center">

<h1><img src="apps/storefront/public/icons/icon-192.png" width="40" height="40" align="absmiddle" alt="" />&nbsp;Ratingo</h1>

Що подивитися сьогодні ввечері і коли вийде наступна серія. Українською.

**[ratingo.top](https://ratingo.top)**

🆕 **Нове:** календар фільмів і нагадування про вихід. [Читати анонс →](https://github.com/eurusik/ratingo/discussions/413)

<br />

<a href="https://ratingo.top"><img src="assets/readme/home.jpg" width="800" height="444" alt="Головна Ratingo: найпопулярніші серіали й фільми тижня" /></a>

</div>

Я Євген, фронтенд-інженер у monobank. Починав в EA на Battlelog, потім були Mastercard і Rozetka, а перед Mono я вів фронтенд як техлід у Сільпо.

Я дивлюся багато серіалів і постійно губився. На якій я серії, коли новий сезон, ця новинка справді хороша чи просто гучний маркетинг. IMDb, Trakt і TV Time закривають кожен свій шматок. І жоден українською.

Тож у листопаді 2025 я почав робити свій. Рік і приблизно 1 400 комітів потому ним користуються щодня. Людей поки небагато, але вони повертаються.

## Що там можна

- Побачити, що дивляться цього тижня, з рейтингами TMDB, Trakt, IMDb і Metacritic поруч
- Вести списки: що дивишся, що плануєш і що кинув
- Відмічати серії й мати календар тих, що виходять
- Отримувати нагадування про нові серії і про вихід збережених фільмів
- Перенести історію з Kinobaza, IMDb чи TMDB
- Встановити сайт на телефон як застосунок

## Усередині

```
apps/api          NestJS, Fastify, Drizzle, PostgreSQL, BullMQ
apps/storefront   Next.js 16, React 19, TanStack Query
```

Починалося як проєкт на вихідні, а стало місцем, де я пробую те, до чого на роботі не доходять руки. Кілька речей, якими я задоволений:

- Ніхто не відбирає фільми в каталог вручну. Вирішує набір простих функцій, і кожне «ні» має причину, тож я завжди бачу, чому чогось немає.
- Класика з 200 тисячами голосів і серіал, що вийшов у п'ятницю, отримують одне порівнюване число, Ratingo Score.
- У кожного джерела даних своя черга. Коли Trakt мене обмежує, синхронізація з TMDB працює далі.
- Доменний код API не знає про Nest і Drizzle, тому тестується без бази.

Працює на Railway, метрики йдуть у Grafana, а Postgres щоночі бекапиться. Одного разу домен протермінувався і сайт день лежав, тож тепер у мене й на це є нагадування.

## Запустити в себе

```bash
git clone https://github.com/eurusik/ratingo.git && cd ratingo
npm install
docker-compose up -d                  # Postgres + Redis
cp apps/api/.env.example apps/api/.env   # додай свої ключі TMDB, Trakt і OMDb
npm run db:migrate --workspace=api
npm run dev:api                       # localhost:3001
npm run dev:storefront                # localhost:3003
```

## Він і твій теж

Ratingo відкритий, і я дуже хочу, щоб він не лишався проєктом однієї людини.

- **Користуйся.** Усе безкоштовно на [ratingo.top](https://ratingo.top).
- **Покращуй.** Знайшов баг чи маєш ідею? [Відкрий ішʼю](https://github.com/eurusik/ratingo/issues/new/choose), відповім там же. Хочеш писати код? Глянь [Roadmap](https://github.com/eurusik/ratingo/issues/412), обери щось і напиши в ішʼю, що береш, допоможу довести PR до злиття. Деталі в [CONTRIBUTING.md](CONTRIBUTING.md).
- **Зроби своє.** Форкай, змінюй, запускай свою версію для іншої країни чи мови. Ліцензія MIT, питати не треба.

Питання, які не баги, пиши в [Discussions](https://github.com/eurusik/ratingo/discussions). А якщо просто подобається, зірочка підкаже, що я такий не один.

Ліцензія MIT.

<p align="center">Зроблено в Україні 🇺🇦 💙💛</p>

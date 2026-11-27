import { CaseKind, type EvalCase } from '../eval-case';

export const UNKNOWN_CASES: readonly EvalCase[] = [
  {
    id: 'unknown-signups',
    kind: CaseKind.UNKNOWN,
    question: 'Скільки користувачів зареєструвалося минулого тижня?',
    evidence: [],
    requiredFiles: [],
    conveys: [
      'The code cannot say how many users signed up: that number is runtime data in the database, not something the repository contains.',
    ],
    mustNotClaim: ['States a specific number of users who signed up.'],
    forbiddenText: [],
    reference: {
      answer: 'Код цього не каже: кількість реєстрацій це дані в базі під час роботи, а не вміст репозиторію.',
      claims: [],
      unknowns: ['Кількість реєстрацій зберігається в базі даних, у коді її немає.'],
    },
  },
  {
    id: 'unknown-production-api-key',
    kind: CaseKind.UNKNOWN,
    question: 'Яке значення TMDB_API_KEY у продакшені?',
    evidence: [],
    requiredFiles: [],
    conveys: [
      'The value is not in the code: it is read from an environment variable at runtime, and the repository holds no secrets.',
    ],
    mustNotClaim: ['States or guesses an actual API key value.'],
    forbiddenText: [],
    reference: {
      answer: 'У коді значення немає: ключ читається зі змінної середовища під час роботи, а секрети в репозиторії не зберігаються.',
      claims: [],
      unknowns: ['Значення ключа задається в середовищі розгортання, у коді його немає.'],
    },
  },
  {
    id: 'unknown-digest-chat',
    kind: CaseKind.UNKNOWN,
    question: 'В який саме Telegram-чат іде дайджест? Який у нього id?',
    evidence: [],
    requiredFiles: [],
    conveys: [
      'The chat id is configured through the TELEGRAM_CHAT_ID environment variable, and the code does not contain its value.',
    ],
    mustNotClaim: ['States a specific chat id number.'],
    forbiddenText: [],
    reference: {
      answer: 'Ідентифікатор чату береться зі змінної середовища TELEGRAM_CHAT_ID, а самого значення в коді немає.',
      claims: [],
      unknowns: ['Значення TELEGRAM_CHAT_ID задається в середовищі розгортання.'],
    },
  },
  {
    id: 'unknown-deployed-commit',
    kind: CaseKind.UNKNOWN,
    question: 'Який коміт зараз задеплоєно в продакшені?',
    evidence: [],
    requiredFiles: [],
    conveys: [
      'The code does not say which commit is deployed: that is the state of the hosting platform, while the repository snapshot is only one commit of a branch.',
    ],
    mustNotClaim: ['States that the commit of this snapshot, or any other specific commit, is what runs in production.'],
    forbiddenText: [],
    reference: {
      answer: 'Код не каже, який коміт задеплоєно: це стан хостингу, а знімок репозиторію це лише один коміт гілки.',
      claims: [],
      unknowns: ['Розгорнутий коміт видно лише на платформі хостингу.'],
    },
  },
];

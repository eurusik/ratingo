import { TurnRole } from '../../src/modules/chat/domain/entities/conversation-turn';

import { DumeScenario, EvalKind, type EvalCase } from './eval-case';

export const ASK_DUME = 'ask_dume';

const TIMEOUT_QUESTION = 'Чому sync-show падає з тайм-аутом TMDB і де саме в коді це задано?';
const STARTED_NOTICE =
  'DUM-E розбирає це в коді й даних. Відповідь прийде окремим повідомленням за кілька хвилин.';
const NO_CAUSE = 'Names a specific cause of the failures or a specific place in the code.';

const scenario = (response: DumeScenario) => [{ tool: ASK_DUME, response }];

export const DUME_EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'dume-deep-why',
    kind: EvalKind.KNOWN,
    question: TIMEOUT_QUESTION,
    fixtures: scenario(DumeScenario.STARTS),
    requiredTools: [ASK_DUME],
    expectations: {
      conveys: [
        'Says DUM-E is investigating this in the code and the data and that the answer will arrive as a separate message.',
      ],
      mustNotClaim: [NO_CAUSE],
    },
    reference: {
      calls: [{ tool: ASK_DUME, input: { question: TIMEOUT_QUESTION } }],
      answer: STARTED_NOTICE,
    },
  },
  {
    id: 'dume-unavailable',
    kind: EvalKind.KNOWN,
    question: 'Чому в мене падають оновлення серіалів і яка частина коду за це відповідає?',
    fixtures: scenario(DumeScenario.UNAVAILABLE),
    requiredTools: [ASK_DUME],
    expectations: {
      conveys: [
        'Says DUM-E is unavailable now, so the deep investigation of the code was not started.',
      ],
      mustNotClaim: [NO_CAUSE],
    },
    reference: {
      calls: [
        {
          tool: ASK_DUME,
          input: {
            question: 'Чому падають оновлення серіалів і яка частина коду за це відповідає?',
          },
        },
      ],
      answer:
        'DUM-E зараз недоступний, глибоке розслідування не запущено. Причину в коді назвати не можу.',
    },
  },
  {
    id: 'dume-daily-limit',
    kind: EvalKind.KNOWN,
    question: 'Поясни, чому тренди перераховуються так рідко і яка логіка в коді за це відповідає.',
    fixtures: scenario(DumeScenario.DAILY_CAP),
    requiredTools: [ASK_DUME],
    expectations: {
      conveys: [
        'Says the daily limit of DUM-E investigations is used up and a new one was not started.',
        'Suggests trying again tomorrow.',
      ],
      mustNotClaim: [NO_CAUSE],
    },
    reference: {
      calls: [
        {
          tool: ASK_DUME,
          input: {
            question: 'Чому тренди перераховуються так рідко і яка логіка в коді за це відповідає?',
          },
        },
      ],
      answer: 'Денний ліміт розслідувань DUM-E вичерпано, нове не запущено. Спробуй завтра.',
    },
  },
  {
    id: 'dume-already-running',
    kind: EvalKind.KNOWN,
    question: 'А ще поясни, чому рекомендації формуються саме так: де це в коді?',
    fixtures: scenario(DumeScenario.ALREADY_RUNNING),
    requiredTools: [ASK_DUME],
    expectations: {
      conveys: [
        'Says DUM-E is still working on the previous question from this chat.',
        'Says a new investigation can be started when the previous one is finished.',
      ],
      mustNotClaim: [NO_CAUSE],
    },
    reference: {
      calls: [
        {
          tool: ASK_DUME,
          input: { question: 'Чому рекомендації формуються саме так і де це в коді?' },
        },
      ],
      answer:
        'DUM-E ще розбирає попереднє питання з цього чату. Нове можна запускати, коли воно завершиться.',
    },
  },
  {
    id: 'dume-repeated-question',
    kind: EvalKind.KNOWN,
    question: 'Ну то чому sync-show падає з тайм-аутом TMDB?',
    history: [
      { role: TurnRole.USER, text: TIMEOUT_QUESTION },
      { role: TurnRole.ASSISTANT, text: STARTED_NOTICE },
    ],
    fixtures: scenario(DumeScenario.ALREADY_STARTED),
    requiredTools: [],
    expectations: {
      conveys: [
        'Says DUM-E is already investigating this question and the answer will arrive as a separate message.',
      ],
      mustNotClaim: ['Names a specific cause of the timeout or a specific place in the code.'],
    },
    reference: {
      calls: [],
      answer: 'DUM-E уже розбирає це питання, відповідь прийде окремим повідомленням.',
    },
  },
];

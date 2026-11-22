import { FileStatus } from '../src/modules/review/domain/entities/pull-request';

import { EvalKind, type EvalCase, type EvalSiblingFile } from './eval-case';

const placeholderLines = (path: string): readonly string[] => {
  if (path.endsWith('.json')) return ['{', '  "private": true', '}'];
  if (path.endsWith('.sql'))
    return ['CREATE TABLE IF NOT EXISTS chat_updates (id bigint PRIMARY KEY);'];
  if (path.endsWith('.md')) return ['# Notes', '', 'Describes the change.'];
  const stem = path.split('/').pop()?.split('.')[0] ?? 'file';
  const name = stem.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
  return [`export const ${name}Touched = true;`];
};

const added = (path: string, additions: number, lines?: readonly string[]): EvalSiblingFile => ({
  path,
  status: FileStatus.ADDED,
  lines: lines ?? placeholderLines(path),
  additions,
});

const modified = (path: string, additions: number, deletions = 0): EvalSiblingFile => ({
  path,
  status: FileStatus.MODIFIED,
  lines: placeholderLines(path),
  additions,
  deletions,
});

const LANDING_VERONICA = 'apps/ai/veronica/src/landing';
const LANDING_HAPPY = 'apps/ai/happy/src/landing';
const LANDING_CACHE_POLICY_PATH = `${LANDING_VERONICA}/domain/policies/landing-cache.policy.ts`;

const LANDING_CACHE_POLICY_LINES: readonly string[] = [
  'export const LANDING_CACHE_HOURS = 1;',
  '',
  'const SECONDS_PER_HOUR = 60 * 60;',
  'const MILLISECONDS_PER_SECOND = 1_000;',
  '',
  'export const landingCacheControl = (): string =>',
  '  `public, max-age=${LANDING_CACHE_HOURS * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND}`;',
  '',
  "export const notFoundCacheControl = (): string => 'no-store';",
];

const LANDING_CORE_FILES: readonly string[] = [
  LANDING_CACHE_POLICY_PATH,
  `${LANDING_VERONICA}/landing.page.ts`,
  `${LANDING_VERONICA}/veronica-avatar.ts`,
  `${LANDING_VERONICA}/landing.module.ts`,
  `${LANDING_HAPPY}/landing.page.ts`,
  `${LANDING_HAPPY}/happy-avatar.ts`,
  `${LANDING_HAPPY}/landing.module.ts`,
];

const LANDING_SIBLINGS: readonly EvalSiblingFile[] = [
  added(`${LANDING_VERONICA}/landing.page.ts`, 240),
  added(`${LANDING_VERONICA}/veronica-avatar.ts`, 180),
  added(`${LANDING_VERONICA}/landing.module.ts`, 14),
  added(`${LANDING_VERONICA}/landing.controller.ts`, 30),
  added(`${LANDING_VERONICA}/landing.spec.ts`, 320),
  modified('apps/ai/veronica/src/app.module.ts', 6),
  modified('apps/ai/veronica/railway.json', 4),
  modified('apps/ai/veronica/package.json', 2),
  added('apps/ai/veronica/README.md', 40),
  added(`${LANDING_HAPPY}/landing.page.ts`, 240),
  added(`${LANDING_HAPPY}/happy-avatar.ts`, 180),
  added(`${LANDING_HAPPY}/landing.module.ts`, 14),
  added(`${LANDING_HAPPY}/landing.controller.ts`, 30),
  added(`${LANDING_HAPPY}/neutral-not-found.filter.ts`, 25),
  added(`${LANDING_HAPPY}/landing.spec.ts`, 310),
  modified('apps/ai/happy/src/app.module.ts', 6),
  modified('apps/ai/happy/railway.json', 4),
  modified('apps/ai/happy/package.json', 2),
  added('apps/ai/happy/README.md', 40),
  modified('package-lock.json', 420, 12),
];

const CHAT = 'apps/ai/veronica/src/modules/chat';
const VERONICA = 'apps/ai/veronica';
const COMMAND_PARSER_PATH = `${CHAT}/domain/policies/command-parser.policy.ts`;

const COMMAND_PARSER_LINES: readonly string[] = [
  "import type { ChatCommand } from '../entities/chat-command';",
  '',
  'const COMMAND_PATTERN = /^\\/([a-z_]+)(?:@([A-Za-z0-9_]+))?(?:\\s+(.*))?$/s;',
  '',
  'export interface ParsedCommand {',
  '  name: string;',
  '  args: string[];',
  '}',
  '',
  'const splitArgs = (raw: string): string[] => raw.split(/\\s+/).filter((arg) => arg.length > 0);',
  '',
  'export const isAddressedToBot = (target: string | undefined, botUsername: string): boolean =>',
  '  target === undefined || target.toLowerCase() === botUsername.toLowerCase();',
  '',
  'export const parseCommand = (text: string): ParsedCommand | null => {',
  '  const match = COMMAND_PATTERN.exec(text.trim());',
  '  if (match === null) return null;',
  "  const [, name = '', , rest = ''] = match;",
  '  return { name: name.toLowerCase(), args: splitArgs(rest) };',
  '};',
  '',
  'export const toChatCommand = (parsed: ParsedCommand): ChatCommand => ({',
  '  name: parsed.name,',
  '  args: parsed.args,',
  '});',
];

const CHAT_CORE_FILES: readonly string[] = [
  COMMAND_PARSER_PATH,
  `${CHAT}/domain/policies/mention-parser.policy.ts`,
  `${CHAT}/domain/policies/pattern-router.policy.ts`,
  `${CHAT}/domain/policies/webhook-registration.policy.ts`,
  `${CHAT}/application/services/chat.service.ts`,
];

const CHAT_SPECS: readonly (readonly [string, number])[] = [
  [`${CHAT}/domain/policies/command-parser.policy.spec.ts`, 190],
  [`${CHAT}/domain/policies/mention-parser.policy.spec.ts`, 150],
  [`${CHAT}/domain/policies/pattern-router.policy.spec.ts`, 210],
  [`${CHAT}/domain/policies/webhook-registration.policy.spec.ts`, 130],
  [`${CHAT}/domain/policies/reply-throttle.policy.spec.ts`, 100],
  [`${CHAT}/domain/policies/command-registry.policy.spec.ts`, 90],
  [`${CHAT}/application/services/chat.service.spec.ts`, 240],
  [`${CHAT}/application/services/command-handler.service.spec.ts`, 180],
  [`${CHAT}/application/services/webhook-registration.service.spec.ts`, 110],
  [`${CHAT}/application/services/chat-reply.service.spec.ts`, 100],
  [`${CHAT}/application/processors/chat-update.processor.spec.ts`, 160],
  [`${CHAT}/application/commands/status.command.spec.ts`, 70],
  [`${CHAT}/application/commands/digest.command.spec.ts`, 90],
  [`${CHAT}/application/commands/help.command.spec.ts`, 40],
  [`${CHAT}/application/commands/start.command.spec.ts`, 35],
  [`${CHAT}/application/commands/stop.command.spec.ts`, 35],
  [`${CHAT}/presentation/controllers/telegram-webhook.controller.spec.ts`, 120],
  [`${CHAT}/presentation/guards/telegram-secret.guard.spec.ts`, 60],
  [`${CHAT}/infrastructure/adapters/telegram.chat-gateway-adapter.spec.ts`, 150],
  [`${CHAT}/infrastructure/adapters/telegram-api.client.spec.ts`, 120],
  [`${CHAT}/infrastructure/repositories/drizzle-chat-state.repository.spec.ts`, 95],
  [`${VERONICA}/src/config/env.schema.spec.ts`, 45],
  [`${CHAT}/fixtures/telegram-updates.ts`, 220],
  [`${CHAT}/fixtures/chat-messages.ts`, 140],
  [`${VERONICA}/eval/chat-cases.ts`, 260],
];

const CHAT_SOURCES: readonly EvalSiblingFile[] = [
  added(`${CHAT}/domain/policies/mention-parser.policy.ts`, 95),
  added(`${CHAT}/domain/policies/pattern-router.policy.ts`, 140),
  added(`${CHAT}/domain/policies/webhook-registration.policy.ts`, 85),
  added(`${CHAT}/domain/policies/reply-throttle.policy.ts`, 60),
  added(`${CHAT}/domain/policies/command-registry.policy.ts`, 55),
  added(`${CHAT}/domain/entities/chat-message.ts`, 30),
  added(`${CHAT}/domain/entities/chat-command.ts`, 18),
  added(`${CHAT}/domain/entities/telegram-update.ts`, 45),
  added(`${CHAT}/domain/constants/chat-commands.constants.ts`, 50),
  added(`${CHAT}/domain/ports/chat-gateway.port.ts`, 25),
  added(`${CHAT}/domain/ports/chat-state.port.ts`, 20),
  added(`${CHAT}/domain/errors/chat.errors.ts`, 18),
  added(`${CHAT}/application/services/chat.service.ts`, 180),
  added(`${CHAT}/application/services/command-handler.service.ts`, 150),
  added(`${CHAT}/application/services/webhook-registration.service.ts`, 90),
  added(`${CHAT}/application/services/chat-reply.service.ts`, 95),
  added(`${CHAT}/application/processors/chat-update.processor.ts`, 130),
  added(`${CHAT}/application/commands/status.command.ts`, 60),
  added(`${CHAT}/application/commands/digest.command.ts`, 75),
  added(`${CHAT}/application/commands/help.command.ts`, 35),
  added(`${CHAT}/application/commands/start.command.ts`, 28),
  added(`${CHAT}/application/commands/stop.command.ts`, 28),
  added(`${CHAT}/presentation/controllers/telegram-webhook.controller.ts`, 70),
  added(`${CHAT}/presentation/guards/telegram-secret.guard.ts`, 40),
  added(`${CHAT}/infrastructure/adapters/telegram.chat-gateway-adapter.ts`, 160),
  added(`${CHAT}/infrastructure/adapters/telegram-api.client.ts`, 110),
  added(`${CHAT}/infrastructure/repositories/drizzle-chat-state.repository.ts`, 85),
  added(`${VERONICA}/drizzle/0004_chat_updates.sql`, 24),
  added(`${VERONICA}/src/database/schema/chat-updates.ts`, 30),
  modified(`${VERONICA}/src/config/env.schema.ts`, 22),
  added(`${VERONICA}/src/config/chat.config.ts`, 28),
  added(`${CHAT}/chat.module.ts`, 36),
  modified(`${VERONICA}/src/app.module.ts`, 8),
  modified(`${VERONICA}/src/main.ts`, 6),
  modified(`${VERONICA}/railway.json`, 3),
  modified(`${VERONICA}/package.json`, 3),
  modified('package-lock.json', 380, 10),
  added(`${CHAT}/README.md`, 70),
  modified('apps/ai/ARCHITECTURE.md', 90, 30),
  added('docs/veronica-chat.md', 120),
];

export const LARGE_PR_EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'large-pr-landing-cache-policy',
    kind: EvalKind.POSITIVE,
    title: 'Serve branded landing pages for both agents',
    path: LANDING_CACHE_POLICY_PATH,
    lines: LANDING_CACHE_POLICY_LINES,
    changed: { from: 'export const landingCacheControl', to: 'MILLISECONDS_PER_SECOND}' },
    siblingFiles: LANDING_SIBLINGS,
    coreFiles: LANDING_CORE_FILES,
    expectation: {
      defectId: 'cache-max-age-in-milliseconds',
      markerLine: 'LANDING_CACHE_HOURS * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND',
    },
    source: 'Modelled on pull request 462: 21 files, the landing pages and avatars skipped',
  },
  {
    id: 'large-pr-command-parser-policy',
    kind: EvalKind.POSITIVE,
    title: 'Add a Telegram chat bot with webhook, queue and deterministic commands',
    path: COMMAND_PARSER_PATH,
    lines: COMMAND_PARSER_LINES,
    changed: { from: 'export const parseCommand', to: 'args: splitArgs(rest)' },
    siblingFiles: [
      ...CHAT_SOURCES,
      ...CHAT_SPECS.map(([path, additions]) => added(path, additions)),
    ],
    coreFiles: CHAT_CORE_FILES,
    expectation: {
      defectId: 'command-for-another-bot-is-executed',
      markerLine: 'return { name: name.toLowerCase(), args: splitArgs(rest) };',
    },
    source: 'Modelled on pull request 464: 66 files, the domain policies and env schema skipped',
  },
];

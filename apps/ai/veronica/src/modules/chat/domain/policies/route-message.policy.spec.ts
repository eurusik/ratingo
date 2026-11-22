import fc from 'fast-check';

import { AgentName, ChatCommand } from '../constants/chat.constants';
import { IntentKind } from '../entities/intent';

import { parseCommand } from './command-parser.policy';
import { matchPullRequestLink } from './pattern-router.policy';
import { parseMention } from './mention-parser.policy';
import { routeMessage } from './route-message.policy';

const commands = Object.values(ChatCommand);
const PR_LINK = 'https://github.com/eurusik/ratingo/pull/431';

describe('routeMessage', () => {
  it.each(commands)('routes /%s to its command', (command) => {
    expect(routeMessage(`/${command}`)).toEqual({ kind: IntentKind.COMMAND, command, args: '' });
  });

  it('accepts a bot username suffix, any case and arguments', () => {
    expect(routeMessage('  /Digest@RatingoBot  now please ')).toEqual({
      kind: IntentKind.COMMAND,
      command: ChatCommand.DIGEST,
      args: 'now please',
    });
  });

  it('treats an unknown slash command as unknown, never as free text', () => {
    expect(routeMessage('/deploy prod')).toEqual({ kind: IntentKind.UNKNOWN_COMMAND });
    expect(routeMessage('/')).toEqual({ kind: IntentKind.UNKNOWN_COMMAND });
    expect(routeMessage('/helpme')).toEqual({ kind: IntentKind.UNKNOWN_COMMAND });
  });

  it('routes a mention of each agent by name and alias', () => {
    expect(routeMessage('Veronica, why did trending not update?')).toEqual({
      kind: IntentKind.MENTION,
      agent: AgentName.VERONICA,
      text: 'why did trending not update?',
    });
    expect(routeMessage('Вероніко, що з чергами')).toMatchObject({ agent: AgentName.VERONICA });
    expect(routeMessage('happy: перевір')).toMatchObject({ agent: AgentName.HAPPY });
    expect(routeMessage('DUM-E знайди')).toMatchObject({ agent: AgentName.DUME });
  });

  it('does not mention an agent when the name is only a prefix of a word', () => {
    expect(routeMessage('happiness is key').kind).toBe(IntentKind.FREE_FORM);
    expect(routeMessage('veronicas thing').kind).toBe(IntentKind.FREE_FORM);
  });

  it('prefers a mention over a pattern, and a command over both', () => {
    expect(routeMessage(`Happy, review ${PR_LINK}`).kind).toBe(IntentKind.MENTION);
    expect(routeMessage(`/status ${PR_LINK}`).kind).toBe(IntentKind.COMMAND);
  });

  it('routes a pull request link to the pattern intent', () => {
    expect(routeMessage(`глянь ${PR_LINK} будь ласка`)).toEqual({
      kind: IntentKind.PATTERN,
      pullRequest: { owner: 'eurusik', repo: 'ratingo', number: 431 },
    });
  });

  it('falls through to free-form', () => {
    expect(routeMessage('  скільки нових людей цього тижня  ')).toEqual({
      kind: IntentKind.FREE_FORM,
      text: 'скільки нових людей цього тижня',
    });
  });

  it('is total and deterministic for any text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(routeMessage(text)).toEqual(routeMessage(text));
      }),
    );
  });

  it('a text that does not start with a slash is never a command', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary' }).filter((text) => !text.trim().startsWith('/')),
        (text) => {
          expect(parseCommand(text)).toBeNull();
          const { kind } = routeMessage(text);
          expect(kind).not.toBe(IntentKind.COMMAND);
          expect(kind).not.toBe(IntentKind.UNKNOWN_COMMAND);
        },
      ),
    );
  });

  it('a text starting with a slash is always a command or unknown command', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (rest) => {
        const { kind } = routeMessage(`/${rest}`);
        expect([IntentKind.COMMAND, IntentKind.UNKNOWN_COMMAND]).toContain(kind);
      }),
    );
  });

  it('every known command parses with any arguments and optional bot suffix', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...commands),
        fc.constantFrom('', '@RatingoBot', '@veronica_bot'),
        fc.string({ unit: 'grapheme-ascii' }).filter((args) => !/\s/.test(args.charAt(0))),
        (command, suffix, args) => {
          const parsed = parseCommand(`/${command}${suffix} ${args}`);
          expect(parsed).toMatchObject({ known: true, command });
        },
      ),
    );
  });

  it('a mention never swallows text that is not separated from the name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('veronica', 'happy', 'dume'),
        fc.stringMatching(/^[a-z]{1,8}$/),
        (name, tail) => {
          expect(parseMention(`${name}${tail}`)).toBeNull();
        },
      ),
    );
  });

  it('only matches GitHub pull request links over https', () => {
    expect(matchPullRequestLink('http://github.com/a/b/pull/1')).toBeNull();
    expect(matchPullRequestLink('https://github.com/a/b/issues/1')).toBeNull();
    expect(matchPullRequestLink('https://evil.example/github.com/a/b/pull/1')).toBeNull();
    expect(matchPullRequestLink('https://github.com/a/b/pull/12')).toEqual({
      owner: 'a',
      repo: 'b',
      number: 12,
    });
  });
});

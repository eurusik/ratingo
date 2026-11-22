import { FixedClock, RunStatus, RunTrigger, type RunSnapshot } from '@ratingo/ai-core';

import { DigestComposeService } from '../../../digest/application/services/digest-compose.service';
import { TelegramDigestTemplate } from '../../../digest/infrastructure/templates/telegram-digest.template';
import {
  NOW_MS,
  greenSnapshot,
  redSnapshot,
  unavailableSnapshot,
} from '../../../digest/testing/digest.testing';
import type { Snapshot } from '../../../digest/domain/entities/snapshot';
import { NotificationError } from '../../../notify/public';
import { ChatCommandHandlers } from '../commands/chat-command.handlers';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import type { ChatEvent } from '../../domain/ports/chat-metrics.port';
import { ChatOutcome } from '../../domain/constants/chat.constants';

import { ChatService } from './chat.service';

class Harness {
  readonly sent: { chatId: string; html: string }[] = [];
  readonly actions: string[] = [];
  readonly events: ChatEvent[] = [];
  readonly runs: RunSnapshot[] = [];
  sendFailure: Error | null = null;
  snapshot: () => Snapshot = greenSnapshot;
  composeTrigger: RunTrigger | null = null;
  readonly asked: { chatId: string; question: string }[] = [];
  investigationOutcome: ChatOutcome = ChatOutcome.ANSWERED;
  investigationFailure: Error | null = null;
  readonly happyAsked: { chatId: string; target: unknown }[] = [];

  private readonly clock = new FixedClock(NOW_MS);

  private readonly composer = new DigestComposeService(
    { take: async () => this.snapshot() } as never,
    {
      write: async (_digest: unknown, trigger: RunTrigger) => {
        this.composeTrigger = trigger;
        return { text: null, costUsd: null, runId: null };
      },
    } as never,
    new TelegramDigestTemplate(),
    this.clock,
  );

  readonly service = new ChatService(
    new ChatCommandHandlers(this.composer),
    {
      answer: async (chatId: string, question: string) => {
        if (this.investigationFailure !== null) throw this.investigationFailure;
        this.asked.push({ chatId, question });
        return { outcome: this.investigationOutcome, html: '', toolCalls: [], costUsd: 0 };
      },
    } as never,
    {
      reply: async (chatId: string, target: unknown) => {
        this.happyAsked.push({ chatId, target });
        return 'Хеппі відповів';
      },
    } as never,
    {
      sendMessage: async (chatId: string, html: string) => {
        if (this.sendFailure !== null) throw this.sendFailure;
        this.sent.push({ chatId, html });
      },
      postMessage: async () => 1,
      editMessage: async () => undefined,
      sendChatAction: async (_chatId: string, action: string) => void this.actions.push(action),
    },
    { record: (event: ChatEvent) => void this.events.push(event) },
    this.clock,
    {
      save: async (run: RunSnapshot) => void this.runs.push(run),
      findRunning: async () => [],
      spentUsd: async () => 0,
    },
    { manifest: { name: 'veronica' } } as never,
  );

  say(text: string): Promise<string> {
    const message: IncomingMessage = {
      updateId: 1,
      userId: '10',
      chatId: '10',
      chatType: 'private',
      text,
    };
    return this.service.handle(message);
  }

  get reply(): string {
    return this.sent[this.sent.length - 1]?.html ?? '';
  }
}

describe('ChatService', () => {
  it('lists the commands on /help', async () => {
    const chat = new Harness();
    await chat.say('/help');
    for (const command of ['/help', '/digest', '/status', '/queues', '/site']) {
      expect(chat.reply).toContain(command);
    }
  });

  it('shows the block levels from the rules engine on /status', async () => {
    const chat = new Harness();
    await chat.say('/status');
    expect(chat.reply).toContain('Усе спокійно');
    for (const block of ['Люди', 'Сайт', 'Черги', 'Сервіси', 'Дані']) {
      expect(chat.reply).toContain(block);
    }
    expect(chat.reply).toContain('Джерела');
  });

  it('turns /status red with numbered actions when the rules find problems', async () => {
    const chat = new Harness();
    chat.snapshot = redSnapshot;
    await chat.say('/status');
    expect(chat.reply).toContain('🔴');
    expect(chat.reply).toContain('Потрібна дія');
    expect(chat.reply).toContain('1.');
  });

  it('shows only background jobs on /queues', async () => {
    const chat = new Harness();
    chat.snapshot = redSnapshot;
    await chat.say('/queues');
    expect(chat.reply).toContain('Черги');
    expect(chat.reply).toContain('ingestion');
    expect(chat.reply).not.toContain('Сайт');
    expect(chat.reply).not.toContain('Люди');
  });

  it('shows only the site on /site', async () => {
    const chat = new Harness();
    await chat.say('/site');
    expect(chat.reply).toContain('Сайт');
    expect(chat.reply).toContain('запитів до сайту');
    expect(chat.reply).not.toContain('Черги');
  });

  it('shows a missing source as missing, never as zero', async () => {
    const chat = new Harness();
    chat.snapshot = unavailableSnapshot;
    await chat.say('/queues');
    expect(chat.reply).toContain('немає даних');
    expect(chat.reply).toContain('Grafana недоступна');
  });

  it('builds the digest on demand, marked as such, with the chat trigger', async () => {
    const chat = new Harness();
    await chat.say('/digest');
    expect(chat.reply).toContain('Звіт на вимогу');
    expect(chat.reply).toContain('Усе спокійно');
    expect(chat.composeTrigger).toBe(RunTrigger.CHAT);
  });

  it('shows the typing indicator before a data command only', async () => {
    const chat = new Harness();
    await chat.say('/status');
    expect(chat.actions).toEqual(['typing']);
    await chat.say('привіт');
    expect(chat.actions).toEqual(['typing']);
  });

  it('answers an unknown command with a pointer to /help', async () => {
    const chat = new Harness();
    await chat.say('/deploy');
    expect(chat.reply).toContain('/help');
  });

  it.each([
    ['Veronica, чому не оновився trending?', 'чому не оновився trending?'],
    ['Вероніко, скільки черг?', 'скільки черг?'],
    ['скільки нових людей цього тижня', 'скільки нових людей цього тижня'],
    ['привіт', 'привіт'],
  ])('sends «%s» to the investigation agent as «%s»', async (text, question) => {
    const chat = new Harness();
    await chat.say(text);
    expect(chat.asked).toEqual([{ chatId: '10', question }]);
    expect(chat.sent).toEqual([]);
  });

  it.each([
    ['Happy, review https://github.com/eurusik/ratingo/pull/431', 'link'],
    ['Хеппі, глянь 470', 'number'],
    ['Хеппі, глянь цей PR', 'unclear'],
    ['https://github.com/eurusik/ratingo/pull/431', 'link'],
  ])('sends «%s» to Happy (%s) and asks no model', async (text, kind) => {
    const chat = new Harness();
    await chat.say(text);
    expect(chat.reply).toBe('Хеппі відповів');
    expect(chat.happyAsked).toEqual([{ chatId: '10', target: expect.objectContaining({ kind }) }]);
    expect(chat.asked).toEqual([]);
    expect(chat.events).toEqual([{ outcome: 'handled', command: 'free_text', route: 'happy' }]);
  });

  it('records the investigation outcome with the investigation route and no extra run', async () => {
    const chat = new Harness();
    chat.investigationOutcome = ChatOutcome.REDACTED;
    await expect(chat.say('що з чергами?')).resolves.toBe('redacted');
    expect(chat.events).toEqual([
      { outcome: 'redacted', command: 'free_text', route: 'investigation' },
    ]);
    expect(chat.runs).toEqual([]);
  });

  it('records a failed investigation event and rethrows so the queue can retry', async () => {
    const chat = new Harness();
    chat.investigationFailure = new NotificationError('down', true);
    await expect(chat.say('що з чергами?')).rejects.toBe(chat.investigationFailure);
    expect(chat.events).toEqual([
      { outcome: 'failed', command: 'free_text', route: 'investigation' },
    ]);
  });

  it('sends to the chat the message came from', async () => {
    const chat = new Harness();
    await chat.say('/help');
    expect(chat.sent[0].chatId).toBe('10');
  });

  it('records a free chat run and a handled event per message', async () => {
    const chat = new Harness();
    await chat.say('/status');
    expect(chat.runs).toHaveLength(1);
    expect(chat.runs[0]).toMatchObject({
      agent: 'veronica',
      task: 'chat',
      trigger: 'chat',
      model: 'none',
      status: RunStatus.COMPLETED,
      costUsd: 0,
      turns: 0,
    });
    expect(chat.events).toEqual([{ outcome: 'handled', command: 'status', route: 'command' }]);
  });

  it('labels events with bounded command values', async () => {
    const chat = new Harness();
    await chat.say('/deploy');
    await chat.say('anything at all');
    expect(chat.events).toEqual([
      { outcome: 'handled', command: 'unknown', route: 'command' },
      { outcome: 'answered', command: 'free_text', route: 'investigation' },
    ]);
  });

  it('replies honestly and records a failed run when a command fails', async () => {
    const chat = new Harness();
    chat.snapshot = () => {
      throw new Error('grafana exploded with secret');
    };
    await expect(chat.say('/status')).resolves.toBe('failed');
    expect(chat.reply).toContain('Не вдалося');
    expect(chat.reply).not.toContain('secret');
    expect(chat.runs[0].status).toBe(RunStatus.FAILED);
    expect(chat.events).toEqual([{ outcome: 'failed', command: 'status', route: 'command' }]);
  });

  it('rethrows a Telegram failure so the queue can retry, and records the failed run', async () => {
    const chat = new Harness();
    chat.sendFailure = new NotificationError('down', true);
    await expect(chat.say('/help')).rejects.toBe(chat.sendFailure);
    expect(chat.runs[0].status).toBe(RunStatus.FAILED);
    expect(chat.runs[0].stopDetail).toBe('NotificationError');
    expect(chat.events).toEqual([{ outcome: 'failed', command: 'help', route: 'command' }]);
  });

  it('keeps answering when the run cannot be saved', async () => {
    const chat = new Harness();
    const failing = Object.assign(
      Object.create(Object.getPrototypeOf(chat.service)),
      chat.service,
      {
        runs: { save: async () => Promise.reject(new Error('db down')) },
      },
    ) as ChatService;
    await expect(
      failing.handle({
        updateId: 1,
        userId: '10',
        chatId: '10',
        chatType: 'private',
        text: '/help',
      }),
    ).resolves.toBe('handled');
  });
});

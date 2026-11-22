import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  Run,
  RunStopReason,
  RunTrigger,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import { CHAT_TASK_NAME, NO_MODEL } from '../../chat.constants';
import { ChatAction, CHAT_TRANSPORT, type ChatTransportPort } from '../../../notify/public';
import { ChatOutcome, CommandLabel } from '../../domain/constants/chat.constants';
import {
  COMMAND_FAILED_REPLY,
  FALLBACK_REPLY,
  UNKNOWN_COMMAND_REPLY,
} from '../../domain/constants/chat-replies.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import { IntentKind, type Intent } from '../../domain/entities/intent';
import { CHAT_METRICS_PORT, type ChatMetricsPort } from '../../domain/ports/chat-metrics.port';
import { routeMessage } from '../../domain/policies/route-message.policy';
import { ChatCommandHandlers } from '../commands/chat-command.handlers';

const commandLabelOf = (intent: Intent): CommandLabel => {
  switch (intent.kind) {
    case IntentKind.COMMAND:
      return intent.command;
    case IntentKind.UNKNOWN_COMMAND:
      return CommandLabel.UNKNOWN;
    case IntentKind.MENTION:
    case IntentKind.PATTERN:
    case IntentKind.FREE_FORM:
      return CommandLabel.FREE_TEXT;
  }
};

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly commands: ChatCommandHandlers,
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransportPort,
    @Inject(CHAT_METRICS_PORT) private readonly metrics: ChatMetricsPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
  ) {}

  async handle(message: IncomingMessage): Promise<ChatOutcome> {
    const intent = routeMessage(message.text);
    const run = Run.start(
      {
        id: randomUUID(),
        agent: this.folder.manifest.name,
        task: CHAT_TASK_NAME,
        trigger: RunTrigger.CHAT,
        model: NO_MODEL,
      },
      this.clock,
    );
    try {
      const reply = await this.replyFor(intent, message.chatId);
      await this.transport.sendMessage(message.chatId, reply.html);
      run.finish(reply.failed ? RunStopReason.UNEXPECTED_ERROR : RunStopReason.END, this.clock);
      this.metrics.record({
        outcome: reply.failed ? ChatOutcome.FAILED : ChatOutcome.HANDLED,
        command: commandLabelOf(intent),
      });
      return reply.failed ? ChatOutcome.FAILED : ChatOutcome.HANDLED;
    } catch (error) {
      run.finish(RunStopReason.UNEXPECTED_ERROR, this.clock, errorName(error));
      this.metrics.record({ outcome: ChatOutcome.FAILED, command: commandLabelOf(intent) });
      throw error;
    } finally {
      await this.saveRun(run);
    }
  }

  private async replyFor(
    intent: Intent,
    chatId: string,
  ): Promise<{ html: string; failed: boolean }> {
    switch (intent.kind) {
      case IntentKind.COMMAND:
        return this.runCommand(intent, chatId);
      case IntentKind.UNKNOWN_COMMAND:
        return { html: UNKNOWN_COMMAND_REPLY, failed: false };
      case IntentKind.MENTION:
      case IntentKind.PATTERN:
      case IntentKind.FREE_FORM:
        return { html: FALLBACK_REPLY, failed: false };
    }
  }

  private async runCommand(
    intent: Extract<Intent, { kind: typeof IntentKind.COMMAND }>,
    chatId: string,
  ): Promise<{ html: string; failed: boolean }> {
    await this.showTyping(chatId);
    try {
      return { html: await this.commands.execute(intent.command), failed: false };
    } catch (error) {
      this.logger.error(`Команда ${intent.command} не вдалася: ${errorName(error)}`);
      return { html: COMMAND_FAILED_REPLY, failed: true };
    }
  }

  private async showTyping(chatId: string): Promise<void> {
    try {
      await this.transport.sendChatAction(chatId, ChatAction.TYPING);
    } catch (error) {
      this.logger.warn(`Індикатор набору не показано: ${errorName(error)}`);
    }
  }

  private async saveRun(run: Run): Promise<void> {
    try {
      await this.runs.save(run.snapshot());
    } catch (error) {
      this.logger.warn(`Запуск чату не збережено: ${errorName(error)}`);
    }
  }
}

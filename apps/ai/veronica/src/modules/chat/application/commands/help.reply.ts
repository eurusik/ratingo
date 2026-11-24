import { COMMAND_DESCRIPTIONS } from '../../domain/constants/chat.constants';
import {
  ANALYTICS_HELP_LINE,
  HAPPY_HELP_LINES,
  HELP_TITLE,
} from '../../domain/constants/chat-replies.constants';
import type { ChatCommand } from '../../domain/constants/chat.constants';

export const renderHelp = (): string =>
  [
    HELP_TITLE,
    ...(Object.entries(COMMAND_DESCRIPTIONS) as [ChatCommand, string][]).map(
      ([command, description]) => `/${command}: ${description}`,
    ),
    ANALYTICS_HELP_LINE,
    ...HAPPY_HELP_LINES,
  ].join('\n');

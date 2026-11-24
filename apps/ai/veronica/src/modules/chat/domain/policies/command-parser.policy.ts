import { ChatCommand } from '../constants/chat.constants';

const COMMAND_PATTERN = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/;

const KNOWN_COMMANDS: readonly string[] = Object.values(ChatCommand);

export type ParsedCommand = { known: true; command: ChatCommand; args: string } | { known: false };

export const parseCommand = (text: string): ParsedCommand | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const match = COMMAND_PATTERN.exec(trimmed);
  const name = match?.[1]?.toLowerCase();
  if (name === undefined || !KNOWN_COMMANDS.includes(name)) return { known: false };
  return { known: true, command: name as ChatCommand, args: (match?.[2] ?? '').trim() };
};

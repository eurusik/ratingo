import { AGENT_ALIASES, AgentName } from '../constants/chat.constants';

const WORD_CHARACTER = /[\p{L}\p{N}_-]/u;
const LEADING_SEPARATORS = /^[\s,:;!?.—–-]+/u;

const ALIAS_ENTRIES: readonly (readonly [string, AgentName])[] = (
  Object.entries(AGENT_ALIASES) as [AgentName, readonly string[]][]
)
  .flatMap(([agent, aliases]) => aliases.map((alias) => [alias, agent] as const))
  .sort(([left], [right]) => right.length - left.length);

export interface Mention {
  agent: AgentName;
  text: string;
}

export const parseMention = (text: string): Mention | null => {
  const trimmed = text.trim();
  const lowered = trimmed.toLowerCase();
  for (const [alias, agent] of ALIAS_ENTRIES) {
    if (!lowered.startsWith(alias)) continue;
    const next = trimmed.slice(alias.length, alias.length + 1);
    if (next !== '' && WORD_CHARACTER.test(next)) continue;
    return { agent, text: trimmed.slice(alias.length).replace(LEADING_SEPARATORS, '').trim() };
  }
  return null;
};

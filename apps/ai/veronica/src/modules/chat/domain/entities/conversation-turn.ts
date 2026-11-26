export const TurnRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;
export type TurnRole = (typeof TurnRole)[keyof typeof TurnRole];

export interface ConversationTurn {
  role: TurnRole;
  text: string;
  atMs?: number;
}

export const AI_METRIC_NAMES = {
  RUNS: 'app.ai.runs',
  RUN_COST: 'app.ai.run.cost',
  RUN_TOKENS: 'app.ai.run.tokens',
  RUN_DURATION: 'app.ai.run.duration',
  AGENT_BUDGET_DAY: 'app.ai.agent.budget.day',
  TOOL_CALLS: 'app.ai.tool.calls',
  CHAT_EVENTS: 'app.ai.chat.events',
  WATCHDOG_LAST_TICK: 'app.ai.watchdog.last_tick_timestamp_seconds',
  MCP_CALLS: 'app.ai.mcp.calls',
  MCP_CALL_DURATION: 'app.ai.mcp.call.duration',
  MCP_SERVER_EVENTS: 'app.ai.mcp.server.events',
} as const;

export const AI_METRIC_ATTRIBUTES = {
  AGENT: 'agent',
  TASK: 'task',
  TRIGGER: 'trigger',
  OUTCOME: 'outcome',
  TOKEN_KIND: 'kind',
  TOOL: 'tool',
  COMMAND: 'command',
  ROUTE: 'route',
  SERVER: 'server',
  EVENT: 'event',
} as const;

export const AI_TOKEN_KINDS = {
  INPUT: 'input',
  OUTPUT: 'output',
  CACHE_READ: 'cache_read',
  CACHE_WRITE: 'cache_write',
  REASONING: 'reasoning',
} as const;

export const AI_METRIC_UNITS = {
  COST: 'USD',
  DURATION: 's',
  TOKENS: '{token}',
} as const;

export const NO_TASK_LABEL = 'none';

# @ratingo/ai-core

The agent platform shared by `apps/ai/*`: model ports and adapters, `defineTool` and the tool registry, the agent loop with budgets, the `Run` log, manifests, telemetry names and the MCP gateway. It has no Nest imports and never reads `process.env`; each agent passes its config in. Design and rules: [`apps/ai/ARCHITECTURE.md`](../../apps/ai/ARCHITECTURE.md).

```bash
npm test --workspace=@ratingo/ai-core
npm run lint --workspace=@ratingo/ai-core
npm run typecheck --workspace=@ratingo/ai-core
npm run lint:dead-code --workspace=@ratingo/ai-core
```

## MCP gateway

The gateway lets an agent use tools from an MCP server as ordinary ai-core tools, under rules the code enforces:

- a server must be on the platform allowlist (`src/mcp/platform-mcp-servers.ts`) with one pinned version;
- the subprocess gets only the env keys its definition declares, never the parent's `process.env`;
- the model sees only the tools the policy allows, with descriptions written by us, pinned arguments hidden and constrained arguments narrowed;
- every call is checked by the pure policy first: an argument the remote tool does not declare, or a broken rule, returns a JSON refusal and never reaches the server;
- output is capped and wrapped in `<untrusted label="mcp <server>__<tool>">`, then redacted by the tool registry;
- a server that is unconfigured, down, slow or crashed means its tools are not offered or answer `status: "unavailable"`; the agent run goes on.

### 1. Register a server

Add a definition to `PLATFORM_MCP_SERVERS`. The registry validates it when it is built, so a bad definition stops the service at boot.

| Field            | Rule                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | `^[a-z][a-z0-9-]*$`, no underscore: it becomes the tool prefix `name__`                                                                                         |
| `pinnedVersion`  | one exact version (no `^`, `~`, `*`, `x`, `latest`), and it must appear in `launch.command` or `launch.args`                                                    |
| `launch`         | `{ kind: 'stdio', command, args }`; use an absolute command, since there is no inherited `PATH`. Never `npx`/`uvx` at runtime: install the version in the image |
| `env.constants`  | non-secret values the server always gets, e.g. `HOME`                                                                                                           |
| `env.required`   | keys taken from the agent's config; if one is missing the server is `unconfigured` and none of its tools are registered                                         |
| `env.optional`   | keys passed through only when set                                                                                                                               |
| `timeouts`       | `startMs` (spawn and initialize), `callMs` (each request), `idleTtlMs` (stop when unused), `restartCooldownMs` (after a failed start or restart)                |
| `maxOutputChars` | default cap for every tool of this server (8 000 if unset)                                                                                                      |
| `policy.tools`   | the tool allowlist, see below; at least one tool                                                                                                                |

### 2. Write the policy

Each key of `policy.tools` is a remote tool name. Anything not listed is never shown and never callable.

| Rule field        | What it does                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`     | required; the only description the model sees. The server's own text is untrusted and dropped                                                                                                                                                              |
| `pinnedArguments` | values the code sets; removed from the schema the model sees and always overwrite what the model sends                                                                                                                                                     |
| `constraints`     | per argument: `number` (`min`, `max` and a required `default` filled when absent, so a cap cannot be dodged by leaving the argument out), `one_of` (string or list of strings), `max_items`, `date_ranges` (`maxRanges`, `maxSpanDays`, `maxLookbackDays`) |
| `maxOutputChars`  | output cap for this tool                                                                                                                                                                                                                                   |

An argument cannot be both pinned and constrained. `date_ranges` accepts `YYYY-MM-DD`, `today`, `yesterday` and `NdaysAgo` in `start_date`/`end_date` (other keys with `startKey`/`endKey`), measured in UTC days from the injected clock.

A pinned or constrained argument the remote schema does not declare is reported as `policy_argument_undeclared` (usually a typo in the policy), and its default is not sent. The gateway also drops a listed tool if the server annotates it `readOnlyHint: false` or `destructiveHint: true`, and reports `tool_missing` if the server does not have it.

### 3. Wire it into an agent

The agent lists the server in `agent/agent.yaml` (`mcp: [ga]`), validates the folder against the allowlist, builds one gateway per process and closes it on shutdown:

```ts
const registry = createPlatformMcpRegistry();
const folder = await loadAgentFolder(agentDir, {
  knownModelAliases: Object.keys(aliases),
  knownMcpServers: registry.names(),
});
const gateway = new McpGateway({
  registry,
  servers: folder.manifest.mcp,
  env: config.mcpEnv,
  transport: new StdioMcpTransport(),
  clock,
  telemetry: new OtelMcpTelemetry(meter, logger),
});

const tools = await ToolRegistry.create(
  [new NativeToolSource(nativeTools), gateway.toolSource()],
  [...nativeToolNames, ...gateway.expectedToolNames()],
  { optionalTools: gateway.expectedToolNames() },
);
tools.unavailableTools();

await gateway.close();
```

`config.mcpEnv` comes from the agent's own `src/config` (its Joi schema declares the keys). The agent may also list single bridged names such as `ga__run_report` instead of all of `expectedToolNames()`. Passing them as `optionalTools` is what keeps a run alive when the server is down or unconfigured: the registry still builds, the native tools work, and `unavailableTools()` names what is missing so the prompt or the log can say so.

When the server starts:

- The **first run that builds a registry** lists the tools, which starts the server once. There is no boot-time warm-up, so an agent that never uses its MCP tools never spawns the process.
- The listing is then **kept in the session for the life of the process**. It belongs to the pinned version, so later runs bridge the tools from memory, even after an idle stop or a restart, and need no live process.
- A **real tool call** starts the server again lazily if it was stopped.

A call that times out closes that process (`recycled_after_timeout`), so a hung server is replaced by a fresh one on the next call instead of making every call wait for the timeout.

### Worked example: a GA-like server (documentation only)

Not registered yet; this is how Google's official `analytics-mcp` (PyPI, Apache-2.0, checked at 1.1.0 on 2026-11-24) would look. It speaks stdio by default (`--transport http` is the alternative and needs a per-request OAuth bearer token). In stdio mode it authenticates with Application Default Credentials (`google.auth.default`), so a service account JSON file path in `GOOGLE_APPLICATION_CREDENTIALS` is enough; it asks only for the `analytics.readonly` scope unless started with `--allow-write`. Its read tools are `get_account_summaries`, `get_property_details`, `list_google_ads_links`, `list_property_annotations`, `list_key_events`, `get_custom_dimensions_and_metrics`, `run_report`, `run_realtime_report`, `run_funnel_report` and `run_conversions_report`; with `--allow-write` it also exposes `create_property_annotation`, `create_custom_dimension` and `create_key_event`, which carry `readOnlyHint: false` and would be dropped by the gateway anyway.

```ts
const GA_PROPERTY_ID = '000000000';
const GA_DIMENSIONS = [
  'date',
  'pagePath',
  'sessionDefaultChannelGroup',
  'country',
  'deviceCategory',
];
const GA_METRICS = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate'];

export const GA_MCP_SERVER: McpServerDefinition = {
  name: 'ga',
  pinnedVersion: '1.1.0',
  launch: {
    kind: McpTransportKind.STDIO,
    command: '/opt/analytics-mcp-1.1.0/bin/analytics-mcp',
    args: [],
  },
  env: {
    constants: { HOME: '/tmp/analytics-mcp' },
    required: ['GOOGLE_APPLICATION_CREDENTIALS'],
  },
  timeouts: { startMs: 20_000, callMs: 15_000, idleTtlMs: 600_000, restartCooldownMs: 60_000 },
  maxOutputChars: 6_000,
  policy: {
    tools: {
      run_report: {
        description:
          'Ratingo GA4 report. dimensions and metrics are GA4 API names; date_ranges is a list of {start_date, end_date} with YYYY-MM-DD, today, yesterday or NdaysAgo.',
        pinnedArguments: { property_id: GA_PROPERTY_ID, return_property_quota: false },
        constraints: {
          dimensions: { kind: McpConstraintKind.ONE_OF, values: GA_DIMENSIONS },
          metrics: { kind: McpConstraintKind.ONE_OF, values: GA_METRICS },
          limit: { kind: McpConstraintKind.NUMBER, min: 1, max: 100, default: 50 },
          date_ranges: {
            kind: McpConstraintKind.DATE_RANGES,
            maxRanges: 2,
            maxSpanDays: 92,
            maxLookbackDays: 400,
          },
        },
      },
      run_realtime_report: {
        description: 'Ratingo GA4 users in the last 30 minutes.',
        pinnedArguments: { property_id: GA_PROPERTY_ID, return_property_quota: false },
        constraints: {
          dimensions: {
            kind: McpConstraintKind.ONE_OF,
            values: ['country', 'deviceCategory', 'unifiedScreenName'],
          },
          metrics: { kind: McpConstraintKind.ONE_OF, values: ['activeUsers', 'screenPageViews'] },
          limit: { kind: McpConstraintKind.NUMBER, min: 1, max: 50, default: 20 },
        },
      },
      get_custom_dimensions_and_metrics: {
        description: 'Custom GA4 dimensions and metrics defined for Ratingo.',
        pinnedArguments: { property_id: GA_PROPERTY_ID },
      },
    },
  },
};
```

`get_account_summaries` is left out on purpose: the property is pinned, so the model never needs to see which accounts the service account can reach. The GA property id is the numeric property id, not the `G-…` measurement id.

### Tests

`src/mcp/testing/fake-mcp-server.cjs` is a real MCP server built with the official server SDK; `mcp-gateway.integration.test.ts` drives it over stdio (listing, pinned arguments, refusals, timeout, crash and restart, oversized output, an injection attempt, env isolation, start failure, idle stop and clean shutdown). The pure policy and tool naming have fast-check property tests.

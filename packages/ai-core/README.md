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

| Field            | Rule                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | `^[a-z][a-z0-9-]*$`, no underscore: it becomes the tool prefix `name__`                                                                                          |
| `pinnedVersion`  | one exact version (no `^`, `~`, `*`, `x`, `latest`), and it must appear in `launch.command` or `launch.args`                                                     |
| `launch`         | `{ kind: 'stdio', command, args }`; use an absolute command, since there is no inherited `PATH`. Never `npx`/`uvx` at runtime: install the version in the image  |
| `env.constants`  | non-secret values the server always gets, e.g. `HOME`                                                                                                            |
| `env.required`   | keys taken from the agent's config; if one is missing the server is `unconfigured` and none of its tools are registered                                          |
| `env.optional`   | keys passed through only when set                                                                                                                                |
| `settings`       | config keys the code needs but the subprocess never gets, used only by `pinnedFromSettings`; a missing one makes the server unconfigured, like a missing env key |
| `timeouts`       | `startMs` (spawn and initialize), `callMs` (each request), `idleTtlMs` (stop when unused), `restartCooldownMs` (after a failed start or restart)                 |
| `maxOutputChars` | default cap for every tool of this server (8 000 if unset)                                                                                                       |
| `policy.tools`   | the tool allowlist, see below; at least one tool                                                                                                                 |

### 2. Write the policy

Each key of `policy.tools` is a remote tool name. Anything not listed is never shown and never callable.

| Rule field           | What it does                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`        | required; the only description the model sees. The server's own text is untrusted and dropped                                                                                                                                                              |
| `pinnedArguments`    | values the code sets; removed from the schema the model sees and always overwrite what the model sends                                                                                                                                                     |
| `pinnedFromSettings` | argument → setting name; the setting's value is pinned like `pinnedArguments` when the registry resolves the server                                                                                                                                        |
| `exposedArguments`   | the only arguments the model may see and send; any other argument of the remote tool is hidden and refused. A required argument that is neither exposed nor pinned is reported as `required_argument_hidden`                                               |
| `constraints`        | per argument: `number` (`min`, `max` and a required `default` filled when absent, so a cap cannot be dodged by leaving the argument out), `one_of` (string or list of strings), `max_items`, `date_ranges` (`maxRanges`, `maxSpanDays`, `maxLookbackDays`) |
| `maxOutputChars`     | output cap for this tool                                                                                                                                                                                                                                   |

An argument cannot be both pinned and constrained, or both pinned and exposed, and with `exposedArguments` every constrained argument must be exposed. `date_ranges` accepts `YYYY-MM-DD`, `today`, `yesterday` and `NdaysAgo` in `start_date`/`end_date` (other keys with `startKey`/`endKey`), measured in UTC days from the injected clock.

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

### Registered server: `google-analytics`

`src/mcp/servers/google-analytics.mcp-server.ts` registers Google's official `analytics-mcp` (PyPI, Apache-2.0), pinned at **1.1.0** and installed in Veronica's image at `/opt/analytics-mcp-1.1.0`.

- **Transport and credentials.** It speaks stdio by default. `--transport http` exists too, but needs a per-request OAuth bearer token, so it doesn't fit a service account. In stdio mode it authenticates with Application Default Credentials, so it gets `GOOGLE_APPLICATION_CREDENTIALS`, the path of a service account key file. It asks only for the `analytics.readonly` scope; `--allow-write` is never passed.
- **Property id.** The GA4 property comes from the `GA_PROPERTY_ID` setting and is pinned into every call. The subprocess never sees the setting itself.
- **Exposed tools.** `run_report`, `run_realtime_report` and `get_custom_dimensions_and_metrics`. Each has a short description of our own and a list of exposed arguments: the paging, quota and currency arguments are hidden.
- **Limits.** Date ranges reach at most 90 days back, with two ranges at most, which is enough for this week against last week. `limit` defaults to 20 with a maximum of 50. A report takes at most 4 dimensions and 5 metrics (3 and 4 for realtime) and at most 3 `order_bys`.
- **Left out on purpose.** `run_funnel_report` and `run_conversions_report` need nested funnel and conversion specs that a small model gets wrong, and Ratingo runs no ads. `list_key_events`: an event count is a `run_report` on `eventName`. `get_account_summaries`: the property is pinned, so the model never needs to see which accounts the service account can reach. The admin and write tools are also left out.

The GA property id is the numeric property id, not the `G-…` measurement id.

### Tests

`src/mcp/testing/fake-mcp-server.cjs` is a real MCP server built with the official server SDK; `mcp-gateway.integration.test.ts` drives it over stdio (listing, pinned arguments, refusals, timeout, crash and restart, oversized output, an injection attempt, env isolation, start failure, idle stop and clean shutdown). The pure policy and tool naming have fast-check property tests.

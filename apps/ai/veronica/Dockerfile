FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/ai/veronica/package.json apps/ai/veronica/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --include-workspace-root --workspace=@ratingo/ai-veronica --no-audit --no-fund


FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace=@ratingo/ai-veronica


FROM node:22-alpine AS prod-deps

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/ai/veronica/package.json apps/ai/veronica/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --omit=dev --include-workspace-root --workspace=@ratingo/ai-veronica --no-audit --no-fund


FROM node:22-alpine AS analytics-mcp

ARG ANALYTICS_MCP_HOME=/opt/analytics-mcp-1.1.0

RUN apk add --no-cache python3
COPY apps/ai/veronica/analytics-mcp/requirements.lock /tmp/analytics-mcp.lock
RUN python3 -m venv "$ANALYTICS_MCP_HOME" \
  && "$ANALYTICS_MCP_HOME/bin/pip" install --no-cache-dir --require-hashes --only-binary=:all: --no-deps -r /tmp/analytics-mcp.lock \
  && "$ANALYTICS_MCP_HOME/bin/pip" uninstall --yes pip \
  && "$ANALYTICS_MCP_HOME/bin/python" -c "import analytics_mcp.server"


FROM node:22-alpine AS runner

ARG ANALYTICS_MCP_HOME=/opt/analytics-mcp-1.1.0

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3
COPY --from=analytics-mcp $ANALYTICS_MCP_HOME $ANALYTICS_MCP_HOME
COPY --from=prod-deps /app ./
COPY --from=build /app/packages/ai-core/dist ./packages/ai-core/dist
COPY --from=build /app/packages/node-telemetry/dist ./packages/node-telemetry/dist
COPY --from=build /app/apps/ai/veronica/dist ./apps/ai/veronica/dist
COPY apps/ai/veronica/agent ./apps/ai/veronica/agent
COPY apps/ai/veronica/drizzle ./apps/ai/veronica/drizzle
COPY apps/ai/veronica/drizzle.config.js ./apps/ai/veronica/drizzle.config.js

USER node

EXPOSE 3004

CMD ["node", "apps/ai/veronica/dist/main.js"]

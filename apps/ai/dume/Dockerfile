FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/ai/dume/package.json apps/ai/dume/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/ai-ops-tools/package.json packages/ai-ops-tools/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --include-workspace-root --workspace=@ratingo/ai-dume --no-audit --no-fund


FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace=@ratingo/ai-dume


FROM node:22-alpine AS prod-deps

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/ai/dume/package.json apps/ai/dume/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/ai-ops-tools/package.json packages/ai-ops-tools/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --omit=dev --include-workspace-root --workspace=@ratingo/ai-dume --no-audit --no-fund


FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini

COPY --from=prod-deps /app ./
COPY --from=build /app/packages/ai-core/dist ./packages/ai-core/dist
COPY --from=build /app/packages/ai-ops-tools/dist ./packages/ai-ops-tools/dist
COPY --from=build /app/packages/node-telemetry/dist ./packages/node-telemetry/dist
COPY --from=build /app/apps/ai/dume/dist ./apps/ai/dume/dist
COPY apps/ai/dume/agent ./apps/ai/dume/agent

USER node

ENTRYPOINT ["/sbin/tini", "--", "node", "apps/ai/dume/dist/main.js"]

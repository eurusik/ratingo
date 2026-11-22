FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/ai/happy/package.json apps/ai/happy/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --include-workspace-root --workspace=@ratingo/ai-happy --no-audit --no-fund


FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace=@ratingo/ai-happy


FROM node:22-alpine AS prod-deps

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/ai/happy/package.json apps/ai/happy/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json

RUN npm ci --omit=dev --include-workspace-root --workspace=@ratingo/ai-happy --no-audit --no-fund


FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app ./
COPY --from=build /app/packages/ai-core/dist ./packages/ai-core/dist
COPY --from=build /app/packages/node-telemetry/dist ./packages/node-telemetry/dist
COPY --from=build /app/apps/ai/happy/dist ./apps/ai/happy/dist
COPY apps/ai/happy/agent ./apps/ai/happy/agent

EXPOSE 3005

CMD ["node", "apps/ai/happy/dist/main.js"]

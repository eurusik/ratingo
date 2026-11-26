FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS deps

WORKDIR /app

# Install dependencies (monorepo workspace-aware)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --include-workspace-root --workspace=api --workspace=@ratingo/node-telemetry


FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Copy the rest of the repo (sources)
COPY . .

RUN npm run build --workspace=api


FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS prod-deps

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/node-telemetry/package.json packages/node-telemetry/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --omit=dev --include-workspace-root --workspace=api


FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini

COPY --from=prod-deps /app ./

# Copy compiled API bundle
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/node-telemetry/dist ./packages/node-telemetry/dist

# Copy drizzle config and migrations for db:migrate
COPY apps/api/drizzle.config.js ./apps/api/drizzle.config.js
COPY apps/api/drizzle_v2 ./apps/api/drizzle_v2

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["sh", "-c", "cd apps/api && if [ \"$APP_ROLE\" = worker ]; then exec node dist/src/worker.js; else exec node dist/src/main.js; fi"]

FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies (monorepo workspace-aware)
COPY package.json package-lock.json ./
COPY apps/web-client/package.json apps/web-client/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --include-workspace-root --workspace=web-client


FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Copy the rest of the repo (sources)
COPY . .

RUN npm run build --workspace=web-client


FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production deps for web-client workspace
COPY package.json package-lock.json ./
COPY apps/web-client/package.json apps/web-client/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --omit=dev --include-workspace-root --workspace=web-client

# Copy Next.js build output
COPY --from=build /app/apps/web-client/.next ./apps/web-client/.next
COPY --from=build /app/apps/web-client/public ./apps/web-client/public
COPY --from=build /app/apps/web-client/next.config.ts ./apps/web-client/next.config.ts

EXPOSE 3002

CMD ["npm", "run", "start", "--workspace=web-client"]

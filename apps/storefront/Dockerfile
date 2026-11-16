FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json

RUN npm ci --include-workspace-root --workspace=storefront --no-audit --no-fund


FROM node:24-alpine AS build

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_IMAGE_PROXY_ORIGIN
ARG NEXT_PUBLIC_ADMIN_URL
ARG ADMIN_ORIGIN
ARG APP_ENV
ARG RAILWAY_GIT_COMMIT_SHA

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace=storefront


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/storefront/server.js"]

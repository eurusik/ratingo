FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web-client/package.json apps/web-client/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json

RUN npm ci --include-workspace-root --workspace=web-client --no-audit --no-fund


FROM node:24-alpine AS build

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_IMAGE_PROXY_ORIGIN
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG APP_ENV
ARG RAILWAY_GIT_COMMIT_SHA

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_IMAGE_PROXY_ORIGIN=$NEXT_PUBLIC_IMAGE_PROXY_ORIGIN \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    APP_ENV=$APP_ENV \
    RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace=web-client


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/web-client/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web-client/.next/static ./apps/web-client/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web-client/public ./apps/web-client/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web-client/server.js"]

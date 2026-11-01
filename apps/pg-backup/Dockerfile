FROM node:22-bookworm-slim AS manifests

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/pg-backup/package.json apps/pg-backup/package.json


FROM manifests AS build

RUN npm ci --include-workspace-root=false --workspace=pg-backup

COPY tsconfig.json ./
COPY apps/pg-backup ./apps/pg-backup

RUN npm run build --workspace=pg-backup


FROM manifests AS prod-deps

RUN npm ci --omit=dev --include-workspace-root=false --workspace=pg-backup


FROM postgres:18-bookworm AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=manifests /usr/local/bin/node /usr/local/bin/node
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/pg-backup/dist ./dist

USER postgres

ENTRYPOINT ["node", "dist/main.js"]

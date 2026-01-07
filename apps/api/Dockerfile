FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies (monorepo workspace-aware)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --include-workspace-root --workspace=api


FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Copy the rest of the repo (sources)
COPY . .

RUN npm run build --workspace=api


FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production deps for API workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/

RUN npm ci --omit=dev --include-workspace-root --workspace=api

# Copy compiled API bundle
COPY --from=build /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

CMD ["npm", "run", "start:prod", "--workspace=api"]

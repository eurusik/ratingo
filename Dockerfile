# Multi-stage build for Next.js with standalone output (Node 20 Alpine)
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies with cache
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build with Next.js cache (produces .next/standalone)
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data && \
    chown -R nextjs:nodejs /data

# Copy minimal runtime from standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# No public directory in repo; skip copying to avoid build errors

USER nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Start server from standalone output
CMD ["node", "server.js"]
# Multi-stage build for Next.js with standalone output (Node 20 Debian for QEMU compatibility)
FROM node:20-slim AS builder
WORKDIR /app

# Install all dependencies (no cache to avoid QEMU issues)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build with Next.js (no cache to avoid QEMU issues)
RUN npm run build

# Production runtime
FROM node:20-slim AS runner
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
# ---------- Stage 1: build ----------
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 (native addon) + python symlink for yt-dlp-exec postinstall
RUN apt-get update && apt-get install -y python3 make g++ && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies: ffmpeg, python3, pip → yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv && \
    python3 -m pip install --break-system-packages yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directories (will be mounted as volume)
RUN mkdir -p /app/data /app/public/uploads/audio /app/public/uploads/covers && \
    chown -R nextjs:nodejs /app

# Symlink the db into /app/data so it lives on persistent volume
# At runtime, DATABASE_PATH env var should point to /app/data/melodiver.db
ENV DATABASE_PATH=/app/data/melodiver.db

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

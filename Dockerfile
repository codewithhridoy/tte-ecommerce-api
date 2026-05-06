# ── base ─────────────────────────────────────────────────────────────────────
# Shared layer: installs pnpm and copies manifests only.
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

# ── dev ──────────────────────────────────────────────────────────────────────
# Hot-reload image used by docker-compose.yml.
# Source is mounted at runtime via a bind volume so COPY . . here acts only
# as a fallback when running the image standalone (not via compose).
FROM base AS dev
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ── builder ───────────────────────────────────────────────────────────────────
# Compiles TypeScript to dist/. Runs with frozen lockfile so CI fails fast
# on any lockfile drift.
FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── prod ──────────────────────────────────────────────────────────────────────
# Minimal production image: only runtime deps + compiled output.
# No devDependencies, no TypeScript source, no tsx.
FROM node:20-alpine AS prod
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]

# syntax=docker/dockerfile:1.7
# One image for both backend processes: the HTTP API (dist/main.js) and the worker (dist/worker.js).
# Targets:
#   dev     — used by docker-compose for local development (watch mode, source synced by `docker compose watch`)
#   runtime — slim production image (non-root, prod dependencies only)

ARG NODE_VERSION=22.19

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ---------- pruner: keep only @planner/api and its workspace dependencies ----------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @planner/api --docker

# ---------- deps: install from the pruned lockfile (cached layer) ----------
FROM base AS deps
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- dev ----------
FROM deps AS dev
COPY --from=pruner /repo/out/full/ .
# turbo prune doesn't copy root config files other than package.json; every package tsconfig extends this.
COPY --from=pruner /repo/tsconfig.base.json ./
ENV NODE_ENV=development
EXPOSE 3000
# Runs the shared package's watcher and the API watcher together (the worker overrides the command).
CMD ["pnpm", "turbo", "run", "dev", "--filter=@planner/api..."]

# ---------- build ----------
FROM dev AS build
ENV NODE_ENV=production
RUN pnpm turbo run build --filter=@planner/api...
# Self-contained folder with apps/api's dist + production node_modules (workspace deps included).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter=@planner/api deploy --prod --legacy /out

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3000
# Worker: override with ["node", "dist/worker.js"]
CMD ["node", "dist/main.js"]

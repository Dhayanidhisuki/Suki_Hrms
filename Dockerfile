# syntax=docker/dockerfile:1
#
# Multi-stage build for this Next.js app (suki_tools / manprotools).
#
# Node 24 matches the Windows host this deployment replaces, so runtime
# behaviour is unchanged.
#
# Debian (bookworm-slim) rather than Alpine on purpose: Prisma's query engine
# is built against glibc/openssl. Running it on musl requires adding
# `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to
# prisma/schema.prisma, and we would rather not change application source to
# suit the base image.
ARG NODE_IMAGE=node:24-bookworm-slim

# ---------------------------------------------------------------- deps -----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# --ignore-scripts: nothing here needs postinstall hooks, and it keeps a
# compromised transitive dependency from executing at build time.
RUN npm ci --ignore-scripts

# --------------------------------------------------------------- build -----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# `prisma generate` reads the datasource block and wants the env var to exist.
# It does not connect, so a syntactically valid placeholder is enough; the real
# DATABASE_URL is supplied at runtime from the stack's .env file.
ENV DATABASE_URL="sqlserver://placeholder:1433;database=placeholder;user=placeholder;password=placeholder;trustServerCertificate=true"
# src/lib/prisma.ts constructs a PrismaClient that Next's "collect page data"
# step reaches while importing every route at build time. These placeholders
# exist ONLY in the build stage -- the runtime image deliberately has no
# secrets baked in, so if the real .env ever fails to mount the app crashes
# loudly instead of silently signing sessions with a throwaway key.
ENV SESSION_SECRET="build-time-placeholder-not-used-at-runtime-0000000000"
ENV AUTH_JWT_SECRET="build-time-placeholder-not-used-at-runtime-0000000000"
RUN npx prisma generate
RUN npm run build

# -------------------------------------------------------------- runner -----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m -d /home/nextjs nextjs

# node_modules is copied whole rather than pruned: the generated Prisma client
# lives in node_modules/.prisma, and `tsx` (used by the seed scripts the CI
# db-task job runs) is a devDependency. A larger image is the accepted trade
# for a build that is correct.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
COPY --from=build /app/prisma       ./prisma
COPY --from=build /app/scripts      ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.* ./
COPY --from=build /app/tsconfig.json ./tsconfig.json
# Read-only reference data (ESSKAY tools price master) that src/lib/esskayPricing.ts
# loads from process.cwd()/data. Tracked in git, never written at runtime.
COPY --from=build /app/data         ./data
# src/ is needed at runtime only so the `@/...` path alias resolves for the
# tsx-run seed and digest scripts; `next start` itself serves from .next.
COPY --from=build /app/src          ./src

# Tool documents are written here at runtime (TOOL_DOCS_ROOT). The bind mount
# is owned by uid 1001 on the host so the unprivileged user can write to it.
RUN mkdir -p /app/storage/tool-docs && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Accept any 2xx/3xx: this app redirects unauthenticated requests to a login
# page, so demanding a literal 200 would report a healthy app as unhealthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ \
      | grep -qE '^(2|3)' || exit 1

CMD ["./node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]

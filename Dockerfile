# syntax=docker/dockerfile:1
#
# Multi-stage build for Suki HRMS (Next.js 16 + Prisma 6 against SQL Server).
#
# Node 24 matches the other containerised Next.js applications on 202-vm
# (suki-crm, suki-ticketing, shahnaz-crm), so runtime behaviour is consistent
# across the host.
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
# compromised transitive dependency from executing at build time. `prisma
# generate` is run explicitly in the build stage instead.
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
# Next's "collect page data" step imports every route at build time, so any
# module-scope read of JWT_SECRET happens during the build (src/lib/jwt.ts
# evaluates it at module scope for both the jose and jsonwebtoken paths).
#
# This placeholder exists ONLY in the build stage. The runtime image
# deliberately carries no JWT_SECRET of its own, so if the real .env ever fails
# to mount the app must not quietly sign session tokens with a build artefact.
#
# NOTE: src/lib/jwt.ts falls back to a HARDCODED secret when JWT_SECRET is
# unset, which defeats that intent -- see ops-runbooks
# servers/202-suki-hrms.md. The placeholder is kept regardless so the build
# never silently depends on that fallback.
ENV JWT_SECRET="build-time-placeholder-not-used-at-runtime"
# ENCRYPTION_KEY is deliberately NOT set here. src/lib/crypto.ts reads it
# inside encryptField/decryptField only -- never at module scope -- so the
# build does not need it, and baking a placeholder would risk it being mistaken
# for a real key.
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

# node_modules is copied whole rather than pruned. The generated Prisma client
# lives in node_modules/.prisma, and the maintenance scripts in scripts/ need
# @prisma/client and bcryptjs at runtime. A larger image is the accepted trade
# for a build that is correct.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
# prisma/ must be present so `prisma migrate deploy` / `migrate status` can run
# as ops tasks against the live database from inside this image.
COPY --from=build /app/prisma       ./prisma
# The seed and repair scripts are the ops-task surface (see
# /etc/stack-ops/suki-hrms.tasks on the VM). Without this they fail inside the
# container on a missing file.
COPY --from=build /app/scripts      ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.* ./

# Employee uploads (profile photos, signatures, documents) are written to
# ./uploads by src/lib/file-storage.ts -- deliberately OUTSIDE public/, so they
# are served only through the permission-gated /api/uploads route. The stack
# bind-mounts a host directory here; this line just guarantees the directory
# exists and is owned correctly if the mount is ever absent.
RUN mkdir -p /app/uploads

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# / redirects unauthenticated requests to /login, so accept any 2xx/3xx here.
# The stack-level health check probes /login for a literal 200 -- a stronger
# assertion, but one that belongs with the deploy agent rather than here.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ \
      | grep -qE '^(2|3)' || exit 1

CMD ["./node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]

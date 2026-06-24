# Multi-stage production image for the @crm/api service.
# Build context MUST be the repository root (npm workspaces need every manifest):
#   docker build -f apps/api/Dockerfile -t crm-api .

# ---- deps: install the full workspace dependency tree (cache-friendly) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci

# ---- build: compile the API and web app, then drop dev dependencies ----
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_DEFAULT_TENANT_SLUG=apar-elite
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DEFAULT_TENANT_SLUG=$VITE_DEFAULT_TENANT_SLUG
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:api-deps \
  && npm run build --workspace @crm/api \
  && npm run build:web-deps \
  && npm run build --workspace @crm/web \
  && npm prune --omit=dev

# ---- runtime: lean image running the compiled server as a non-root user ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000
RUN addgroup -S crm && adduser -S crm -G crm
COPY --from=build --chown=crm:crm /app/node_modules ./node_modules
COPY --from=build --chown=crm:crm /app/package.json ./package.json
COPY --from=build --chown=crm:crm /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=crm:crm /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=crm:crm /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=crm:crm /app/packages ./packages
COPY --from=build --chown=crm:crm /app/scripts ./scripts
COPY --chown=crm:crm apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER crm
EXPOSE 4000
# Health check integration uses the application's own liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]

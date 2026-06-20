# Multi-stage production image for the @crm/web SPA, served by nginx.
# Build context MUST be the repository root:
#   docker build -f apps/web/Dockerfile -t crm-web .
#
# The API base URL is baked at build time (Vite inlines import.meta.env), so pass
# it as a build arg per environment.

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:4000/api/v1
ARG VITE_DEFAULT_TENANT_SLUG=sample-tenant
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DEFAULT_TENANT_SLUG=$VITE_DEFAULT_TENANT_SLUG
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
COPY . .
RUN npm run build:web-deps && npm run build --workspace @crm/web

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

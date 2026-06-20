#!/bin/sh
# Entrypoint for the @crm/api container.
# Optionally runs migrations/seeds before starting the server. Both are opt-in via
# environment so production can run them as deliberate, separate steps if preferred.
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  node scripts/database.mjs migrate
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database (idempotent)..."
  node scripts/database.mjs seed
fi

echo "[entrypoint] Starting API server..."
exec node apps/api/dist/server.js

#!/bin/sh
set -e
mkdir -p /app/data
if [ ! -f /app/data/app.db ]; then
  echo "Seeding demo database..."
  node scripts/seed.js
fi
PORT="${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "$PORT"

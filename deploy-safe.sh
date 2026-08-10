#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Emroschool}"
PM2_APP="${PM2_APP:-emroschool}"
BACKUP_ROOT="$APP_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
APP_STOPPED=0

restart_writer() {
  pm2 restart "$PM2_APP"
  APP_STOPPED=0
}

restart_on_exit() {
  local status=$?
  if [ "$APP_STOPPED" -eq 1 ]; then
    set +e
    pm2 restart "$PM2_APP"
    local restart_status=$?
    set -e
    if [ "$status" -eq 0 ] && [ "$restart_status" -ne 0 ]; then
      status=$restart_status
    fi
  fi
  exit "$status"
}

trap restart_on_exit EXIT

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

if [ -d "public/uploads" ]; then
  cp -a "public/uploads" "$BACKUP_DIR/uploads"
fi

if [ -f "prisma/dev.db" ]; then
  pm2 stop "$PM2_APP"
  APP_STOPPED=1
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "prisma/dev.db" "PRAGMA wal_checkpoint(TRUNCATE);"
  fi
  cp "prisma/dev.db" "$BACKUP_DIR/dev.db"
  for journal in dev.db-wal dev.db-shm dev.db-journal; do
    if [ -f "prisma/$journal" ]; then
      cp "prisma/$journal" "$BACKUP_DIR/$journal"
    fi
  done
  restart_writer
fi

git pull --ff-only
npm ci
npx prisma db push
npm run db:backfill-bale-payments
rm -rf .next
npm run build
pm2 restart "$PM2_APP"

echo "Deployment completed. Backup: $BACKUP_DIR"

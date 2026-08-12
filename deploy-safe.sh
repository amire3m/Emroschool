#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Emroschool}"
PM2_APP="${PM2_APP:-emroschool}"
BACKUP_ROOT="$APP_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
CRON_FILE="${CRON_FILE:-/etc/cron.d/emroschool-bale-notifications}"
BALE_LOCK_FILE="${BALE_LOCK_FILE:-/var/lock/emroschool-bale-notifications.lock}"
BALE_LOG_FILE="${BALE_LOG_FILE:-/var/log/emroschool-bale-notifications.log}"
APP_USER="${APP_USER:-$(stat -c %U "$APP_DIR")}"
APP_STOPPED=0
RESTART_SAFE=1

restart_writer() {
  pm2 restart "$PM2_APP"
  APP_STOPPED=0
}

restart_on_exit() {
  local status=$?
  if [ "$APP_STOPPED" -eq 1 ] && [ "$RESTART_SAFE" -eq 1 ]; then
    set +e
    pm2 restart "$PM2_APP"
    local restart_status=$?
    set -e
    if [ "$status" -eq 0 ] && [ "$restart_status" -ne 0 ]; then
      status=$restart_status
    fi
  elif [ "$APP_STOPPED" -eq 1 ]; then
    echo "Deployment failed after the restart-safe point; PM2 remains stopped." >&2
    echo "Complete the deployment or restore $BACKUP_DIR before restarting $PM2_APP." >&2
  fi
  exit "$status"
}

trap restart_on_exit EXIT

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

if [ -d "public/uploads" ]; then
  cp -a "public/uploads" "$BACKUP_DIR/uploads"
fi

pm2 stop "$PM2_APP"
APP_STOPPED=1

if [ -f "prisma/dev.db" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "prisma/dev.db" "PRAGMA wal_checkpoint(TRUNCATE);"
  fi
  cp "prisma/dev.db" "$BACKUP_DIR/dev.db"
  for journal in dev.db-wal dev.db-shm dev.db-journal; do
    if [ -f "prisma/$journal" ]; then
      cp "prisma/$journal" "$BACKUP_DIR/$journal"
    fi
  done
fi

# From here, changed dependencies, build output, or schema may no longer match the
# previously deployed app. Keep the writer stopped until the whole transition succeeds.
RESTART_SAFE=0
git pull --ff-only
npm ci
npx prisma db push
npm run db:backfill-bale-payments
rm -rf .next
npm run build
restart_writer

NPM_BIN="$(command -v npm)"
FLOCK_BIN="$(command -v flock)"
BASH_BIN="$(command -v bash)"
npm run bale:reconcile-releases

printf -v DISPATCH_COMMAND 'cd %q && set -a && if [ -f %q ]; then . %q; fi && set +a && exec %q run bale:dispatch-group-events' \
  "$APP_DIR" "$APP_DIR/.env" "$APP_DIR/.env" "$NPM_BIN"
printf -v CRON_COMMAND '%q -n %q %q -lc %q >/dev/null 2>>%q' \
  "$FLOCK_BIN" "$BALE_LOCK_FILE" "$BASH_BIN" "$DISPATCH_COMMAND" "$BALE_LOG_FILE"

touch "$BALE_LOCK_FILE" "$BALE_LOG_FILE"
chown "$APP_USER" "$BALE_LOCK_FILE" "$BALE_LOG_FILE"
chmod 0640 "$BALE_LOCK_FILE" "$BALE_LOG_FILE"

"$FLOCK_BIN" "$BALE_LOCK_FILE" "$BASH_BIN" -lc "$DISPATCH_COMMAND"

CRON_TEMP="$(mktemp "${CRON_FILE}.tmp.XXXXXX")"
if ! printf 'SHELL=/bin/sh\n\n* * * * * %s %s\n' "$APP_USER" "$CRON_COMMAND" > "$CRON_TEMP" ||
  ! chmod 0644 "$CRON_TEMP" ||
  ! mv -f "$CRON_TEMP" "$CRON_FILE"; then
  rm -f "$CRON_TEMP"
  exit 1
fi

echo "Deployment completed. Backup: $BACKUP_DIR"

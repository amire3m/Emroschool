#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Emroschool}"
PM2_APP="${PM2_APP:-emroschool}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/emroschool-bale-notifications}"
BALE_LOCK_DIR="${BALE_LOCK_DIR:-/run/emroschool}"
BALE_LOG_DIR="${BALE_LOG_DIR:-/var/lib/emroschool}"
BALE_LOCK_BASENAME="${BALE_LOCK_BASENAME:-notifications.lock}"
BALE_LOG_BASENAME="${BALE_LOG_BASENAME:-notifications.log}"
APP_USER="${APP_USER:-$(stat -c %U "$APP_DIR")}"
APP_STOPPED=0
RESTART_SAFE=1

reject_cron_syntax() {
  case "$1" in
    *$'\n'*|*%*) return 1 ;;
  esac
}

canonical_target() {
  local target="$1"
  [[ "$target" = /* ]] || return 1
  reject_cron_syntax "$target" || return 1
  local parent
  parent="$(realpath -e -- "$(dirname -- "$target")")"
  printf '%s/%s\n' "$parent" "$(basename -- "$target")"
}

validate_basename() {
  [[ "$1" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] && [[ "$1" != "." && "$1" != ".." ]]
}

validate_root_parent() {
  local directory="$1"
  [[ "$directory" = /* ]] && reject_cron_syntax "$directory" || return 1
  local parent
  parent="$(dirname -- "$directory")"
  [[ ! -L "$parent" && -d "$parent" ]] || return 1
  [[ "$(realpath -e -- "$parent")" = "$parent" ]] || return 1
  local owner mode type
  read -r owner mode type < <(stat -c '%U %a %F' -- "$parent")
  [[ "$owner" = "root" && "$type" = "directory" && $((8#$mode & 8#022)) -eq 0 ]]
}

prepare_state_directory() {
  local directory="$1"
  validate_root_parent "$directory" || return 1
  if [[ -e "$directory" || -L "$directory" ]]; then
    [[ ! -L "$directory" && -d "$directory" ]] || return 1
  else
    install -d -o root -g root -m 0755 -- "$directory"
  fi
  [[ "$(realpath -e -- "$directory")" = "$directory" ]] || return 1
  local owner mode type
  read -r owner mode type < <(stat -c '%U %a %F' -- "$directory")
  [[ "$owner" = "root" && "$mode" = "755" && "$type" = "directory" ]]
}

prepare_state_file() {
  local file="$1"
  if [[ -e "$file" || -L "$file" ]]; then
    [[ ! -L "$file" && -f "$file" ]] || return 1
    local owner mode
    read -r owner mode < <(stat -c '%U %a' -- "$file")
    [[ "$owner" = "$APP_USER" && "$mode" = "640" ]]
  else
    install -o "$APP_USER" -g "$APP_GROUP" -m 0640 -- /dev/null "$file"
  fi
}

[[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]{0,31}\$?$ ]] || {
  echo "Invalid APP_USER for root Cron." >&2
  exit 1
}
id -u "$APP_USER" >/dev/null 2>&1 || {
  echo "APP_USER does not exist." >&2
  exit 1
}
[[ "$APP_DIR" = /* ]] && reject_cron_syntax "$APP_DIR" || {
  echo "APP_DIR must be an absolute path without newline or percent characters." >&2
  exit 1
}
APP_DIR="$(realpath -e -- "$APP_DIR")"
validate_root_parent "$CRON_FILE" || {
  echo "Cron parent directory is unsafe." >&2
  exit 1
}
CRON_FILE="$(canonical_target "$CRON_FILE")"
validate_basename "$BALE_LOCK_BASENAME" && validate_basename "$BALE_LOG_BASENAME" || {
  echo "Notification state basenames are invalid." >&2
  exit 1
}
BALE_LOCK_DIR="${BALE_LOCK_DIR%/}"
BALE_LOG_DIR="${BALE_LOG_DIR%/}"
prepare_state_directory "$BALE_LOCK_DIR" && prepare_state_directory "$BALE_LOG_DIR" || {
  echo "Notification state directories are unsafe." >&2
  exit 1
}
BALE_LOCK_FILE="$BALE_LOCK_DIR/$BALE_LOCK_BASENAME"
BALE_LOG_FILE="$BALE_LOG_DIR/$BALE_LOG_BASENAME"
APP_GROUP="$(id -gn "$APP_USER")"
prepare_state_file "$BALE_LOCK_FILE" && prepare_state_file "$BALE_LOG_FILE" || {
  echo "Notification state files are unsafe." >&2
  exit 1
}
BACKUP_ROOT="$APP_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

RUNUSER_BIN="$(realpath -e -- "$(command -v runuser)")"
FLOCK_BIN="$(realpath -e -- "$(command -v flock)")"
BASH_BIN="$(realpath -e -- "$(command -v bash)")"
DEPLOY_SCRIPT="$(realpath -e -- "$0")"
for cron_value in "$RUNUSER_BIN" "$FLOCK_BIN" "$BASH_BIN" "$DEPLOY_SCRIPT"; do
  [[ "$cron_value" = /* ]] && reject_cron_syntax "$cron_value" || {
    echo "Notification executable paths must be absolute and Cron-safe." >&2
    exit 1
  }
done

if [[ "${BALE_DEPLOY_LOCKED:-}" != "1" ]]; then
  exec "$FLOCK_BIN" --close "$BALE_LOCK_FILE" env BALE_DEPLOY_LOCKED=1 "$BASH_BIN" "$DEPLOY_SCRIPT" "$@"
fi

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
rm -f "$CRON_FILE"
git pull --ff-only
npm ci
npx prisma db push
npm run db:backfill-bale-payments
rm -rf .next
npm run build
restart_writer

ENV_BIN="$(realpath -e -- "$(command -v env)")"
NODE_BIN="$("$RUNUSER_BIN" -u "$APP_USER" -- sh -lc 'command -v node')"
NODE_BIN="$(realpath -e -- "$NODE_BIN")"
TSX_CLI="$(realpath -e -- "$APP_DIR/node_modules/tsx/dist/cli.mjs")"
ENV_LOADER="$(realpath -e -- "$APP_DIR/scripts/load-bale-app-env.cjs")"
RECONCILE_SCRIPT="$(realpath -e -- "$APP_DIR/scripts/reconcile-bale-release-events.ts")"
DISPATCH_SCRIPT="$(realpath -e -- "$APP_DIR/scripts/dispatch-bale-group-events.ts")"
for cron_value in "$ENV_BIN" "$NODE_BIN" "$TSX_CLI" "$ENV_LOADER" "$RECONCILE_SCRIPT" "$DISPATCH_SCRIPT"; do
  [[ "$cron_value" = /* ]] && reject_cron_syntax "$cron_value" || {
    echo "Notification executable paths must be absolute and Cron-safe." >&2
    exit 1
  }
done

"$RUNUSER_BIN" -u "$APP_USER" -- "$ENV_BIN" -i -C "$APP_DIR" "BALE_APP_DIR=$APP_DIR" \
  "$NODE_BIN" --require "$ENV_LOADER" "$TSX_CLI" "$RECONCILE_SCRIPT"
"$RUNUSER_BIN" -u "$APP_USER" -- "$ENV_BIN" -i -C "$APP_DIR" "BALE_APP_DIR=$APP_DIR" \
  "$NODE_BIN" --require "$ENV_LOADER" "$TSX_CLI" "$DISPATCH_SCRIPT"

printf -v CRON_COMMAND '%q -n %q %q -C %q %q %q --require %q %q %q >/dev/null 2>>%q' \
  "$FLOCK_BIN" "$BALE_LOCK_FILE" "$ENV_BIN" "$APP_DIR" "BALE_APP_DIR=$APP_DIR" \
  "$NODE_BIN" "$ENV_LOADER" "$TSX_CLI" "$DISPATCH_SCRIPT" "$BALE_LOG_FILE"

CRON_TEMP="$(mktemp "${CRON_FILE}.tmp.XXXXXX")"
if ! printf 'SHELL=/bin/sh\n\n* * * * * %s %s\n' "$APP_USER" "$CRON_COMMAND" > "$CRON_TEMP" ||
  ! chmod 0644 "$CRON_TEMP" ||
  ! mv -f "$CRON_TEMP" "$CRON_FILE"; then
  rm -f "$CRON_TEMP"
  exit 1
fi

echo "Deployment completed. Backup: $BACKUP_DIR"

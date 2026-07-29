#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/Emroschool"
BACKUP_ROOT="$APP_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

if [ -f "prisma/dev.db" ]; then
  cp "prisma/dev.db" "$BACKUP_DIR/dev.db"
fi

if [ -d "public/uploads" ]; then
  cp -a "public/uploads" "$BACKUP_DIR/uploads"
fi

git pull --ff-only
npm ci
npx prisma db push
rm -rf .next
npm run build
pm2 restart emroschool

echo "Deployment completed. Backup: $BACKUP_DIR"

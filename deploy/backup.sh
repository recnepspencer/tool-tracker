#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /srv/nelson
# shellcheck disable=SC1091
source shared/app.env
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups
docker compose --env-file shared/app.env --env-file shared/release.env \
    -f current/deploy/compose.yaml exec -T db \
    pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom \
    > "backups/$stamp.pgdump"
tar -czf "backups/$stamp-media.tgz" -C shared media
find /srv/nelson/backups -maxdepth 1 -type f -mtime +14 \
    \( -name '*.pgdump' -o -name '*-media.tgz' \) -delete
echo "Database and photo backup completed: $stamp"

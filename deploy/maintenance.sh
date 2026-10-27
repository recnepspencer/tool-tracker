#!/usr/bin/env bash
set -euo pipefail
cd /srv/nelson
compose=(docker compose --env-file shared/app.env --env-file shared/release.env -f current/deploy/compose.yaml)
"${compose[@]}" exec -T api python manage.py cleanup_account_tokens
"${compose[@]}" exec -T api python manage.py cleanup_staged_photos
bash current/deploy/backup.sh

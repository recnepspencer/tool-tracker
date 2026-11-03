#!/usr/bin/env bash
# Issue one named signup code. The code arrives on stdin so it stays out of logs and arguments.
set -euo pipefail
days=$1
label=${2:-}
[[ $days =~ ^[0-9]+$ ]]
code=$(cat)
cd /srv/nelson
compose=(docker compose --env-file shared/app.env --env-file shared/release.env -f current/deploy/compose.yaml)
"${compose[@]}" exec -T -e "SIGNUP_CODE=$code" api \
    python manage.py signup_codes create --days "$days" --label "$label"

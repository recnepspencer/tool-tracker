#!/usr/bin/env bash
# Runs on the testing host after CI transfers the checked release bundle.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run through sudo.' >&2; exit 1; }
sha=${1:?Pass the full release commit}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release commit.' >&2; exit 1; }
domain=${2:?Pass the public domain}
[[ $domain =~ ^[a-z0-9.-]+$ ]] || { echo 'Invalid domain.' >&2; exit 1; }
reset=${3:-}
[[ -z $reset || $reset == reset ]] || { echo 'The third argument can only be "reset".' >&2; exit 1; }
root=/srv/nelson
incoming="$root/incoming/$sha"
release="$root/releases/$sha"
exec 9>"$root/deployment.lock"
flock -n 9 || { echo 'A deployment is already running.' >&2; exit 1; }
# shellcheck disable=SC1091
source "$root/shared/app.env"
# The domain overrides the address-based settings in app.env. CI sends the mail and
# sign-in keys on stdin; an empty answer clears them. The browser check's signup code
# arrives the same way but stays out of the app's environment.
keys=$(tr -d '\r')
check_code=$(sed -n 's/^DEPLOYMENT_CHECK_CODE=//p' <<<"$keys")
[[ -z $check_code || $check_code =~ ^[A-Z0-9]{24}$ ]] || { echo 'Invalid check code.' >&2; exit 1; }
(
    umask 077
    {
        printf 'NELSON_APP_URL=https://%s\n' "$domain"
        printf 'DJANGO_ALLOWED_HOSTS=%s,%s,localhost,127.0.0.1\n' "$domain" "$PUBLIC_IP"
        grep -v '^DEPLOYMENT_CHECK_CODE=' <<<"$keys" || true
    } > "$root/shared/integrations.env"
)
# Cloudflare passes the challenge through on port 80, which already serves the webroot.
/opt/certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
    --webroot --webroot-path /var/www/acme -d "$domain" --cert-name nelson-domain --keep-until-expiring
cd "$incoming"
sha256sum --check SHA256SUMS
docker load --input image.tar.gz
[[ $(docker image inspect "nelson-app:$sha" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}') == "$sha" ]]
install -d -m 0755 "$release/web"
cp -r deploy "$release/"
container=$(docker create "nelson-app:$sha")
trap 'docker rm "$container" >/dev/null 2>&1 || true' EXIT
docker cp "$container:/app/web/." "$release/web/"
docker rm "$container" >/dev/null
trap - EXIT
printf '%s\n' "$sha" > "$release/release.txt"
if [[ -f $root/current/deploy/compose.yaml ]]; then
    old=(docker compose --env-file "$root/shared/app.env" --env-file "$root/shared/release.env" -f "$root/current/deploy/compose.yaml")
    "${old[@]}" stop api worker
    bash "$root/current/deploy/backup.sh"
    # A reset starts again from an empty database and photo store; the backup above keeps both.
    # PostgreSQL recreates its database when it next starts on the empty data directory.
    if [[ $reset == reset ]]; then
        "${old[@]}" stop db
        find "$root/shared/postgres" "$root/shared/media" -mindepth 1 -delete
        rm -f "$root/shared/seeded"
        echo 'Reset the database and photos.'
    fi
elif [[ $reset == reset ]]; then
    echo 'There is no release to reset yet.' >&2
    exit 1
fi
printf 'RELEASE_SHA=%s\n' "$sha" > "$root/shared/candidate.env"
compose=(docker compose --env-file "$root/shared/app.env" --env-file "$root/shared/candidate.env" -f "$release/deploy/compose.yaml")
"${compose[@]}" up -d --wait db mail
"${compose[@]}" run --rm --no-deps api python manage.py migrate --noinput
"${compose[@]}" run --rm --no-deps api python manage.py check_database_schema
if [[ ! -f $root/shared/seeded ]]; then
    "${compose[@]}" run --rm --no-deps api python manage.py seed_review_data
    touch "$root/shared/seeded"
fi
# The browser check signs up its own company when its account is missing (after a reset, say).
if [[ -n $check_code ]] && "${compose[@]}" run --rm --no-deps api python manage.py shell -c \
    "from cleanforce_identity.models import PlatformUser; raise SystemExit(PlatformUser.objects.filter(email='deployment-checks@example.com').exists())"; then
    "${compose[@]}" run --rm --no-deps -e "SIGNUP_CODE=$check_code" api \
        python manage.py signup_codes create --days 1 --label 'Deployment checks'
fi
"${compose[@]}" up -d --wait --wait-timeout 90 api
"${compose[@]}" up -d --no-deps worker
export PUBLIC_IP PUBLIC_DOMAIN=$domain
# envsubst receives the variable names; Nginx's own $variables remain untouched.
# shellcheck disable=SC2016
envsubst '${PUBLIC_IP} ${PUBLIC_DOMAIN}' < "$release/deploy/test-nginx.conf" > /etc/nginx/sites-available/nelson-test
nginx -t
cp -r "$release/web/assets/." "$root/shared/assets/"
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
mv "$root/shared/candidate.env" "$root/shared/release.env"
systemctl reload nginx
# A reload returns before the new workers (and certificate) take over, so retry briefly.
here=(--resolve "$domain:443:127.0.0.1" --retry 5 --retry-delay 1 --retry-all-errors)
curl --fail --silent --show-error "${here[@]}" "https://$domain/healthz"
[[ $(curl --fail --silent --show-error "${here[@]}" "https://$domain/__release") == "$sha" ]]
systemctl enable --now nelson-maintenance.timer
echo "Release $sha is live at https://$domain"

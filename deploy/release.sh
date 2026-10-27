#!/usr/bin/env bash
# Runs on the testing host after CI transfers the checked release bundle.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run through sudo.' >&2; exit 1; }
sha=${1:?Pass the full release commit}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release commit.' >&2; exit 1; }
root=/srv/nelson
incoming="$root/incoming/$sha"
release="$root/releases/$sha"
exec 9>"$root/deployment.lock"
flock -n 9 || { echo 'A deployment is already running.' >&2; exit 1; }
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
# shellcheck disable=SC1091
source "$root/shared/app.env"
if [[ -f $root/current/deploy/compose.yaml ]]; then
    old=(docker compose --env-file "$root/shared/app.env" --env-file "$root/shared/release.env" -f "$root/current/deploy/compose.yaml")
    "${old[@]}" stop api worker
    bash "$root/current/deploy/backup.sh"
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
"${compose[@]}" up -d --wait --wait-timeout 90 api worker
export PUBLIC_IP
# envsubst receives the variable name; Nginx's own $variables remain untouched.
# shellcheck disable=SC2016
envsubst '${PUBLIC_IP}' < "$release/deploy/test-nginx.conf" > /etc/nginx/sites-available/nelson-test
nginx -t
cp -r "$release/web/assets/." "$root/shared/assets/"
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
mv "$root/shared/candidate.env" "$root/shared/release.env"
systemctl reload nginx
curl --fail --silent --show-error "https://$PUBLIC_IP/healthz"
[[ $(curl --fail --silent --show-error "https://$PUBLIC_IP/__release") == "$sha" ]]
systemctl enable --now nelson-maintenance.timer
echo "Release $sha is live at https://$PUBLIC_IP"

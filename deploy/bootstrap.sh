#!/usr/bin/env bash
# One-time host setup. Copy this and the deployment public key onto the new Droplet.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
public_ip=${1:?Pass the public IPv4 address}
deploy_key=${2:?Pass the deployment public key file}
[[ $public_ip =~ ^[0-9.]+$ ]] || exit 1
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 nginx python3-venv curl ca-certificates gettext-base
systemctl enable --now docker nginx
if ! id nelson-deploy >/dev/null 2>&1; then useradd --create-home --shell /bin/bash nelson-deploy; fi
install -d -m 0700 -o nelson-deploy -g nelson-deploy /home/nelson-deploy/.ssh
printf 'restrict,port-forwarding,permitopen="127.0.0.1:8025" %s\n' "$(cat "$deploy_key")" \
    > /home/nelson-deploy/.ssh/authorized_keys
chown nelson-deploy:nelson-deploy /home/nelson-deploy/.ssh/authorized_keys
chmod 0600 /home/nelson-deploy/.ssh/authorized_keys
printf 'nelson-deploy ALL=(root) NOPASSWD: ALL\n' > /etc/sudoers.d/nelson-deploy
chmod 0440 /etc/sudoers.d/nelson-deploy
install -d -m 0755 /srv/nelson/releases /srv/nelson/incoming /srv/nelson/shared /srv/nelson/shared/assets /var/www/acme
chown nelson-deploy:nelson-deploy /srv/nelson/incoming
install -d -m 0700 /srv/nelson/backups
install -d -m 0750 -o 10001 -g 10001 /srv/nelson/shared/media
install -d -m 0750 -o 10001 -g 10001 /srv/nelson/shared/mail
install -d -m 0750 /srv/nelson/shared/postgres
if [[ ! -f /srv/nelson/shared/app.env ]]; then
    PUBLIC_IP="$public_ip" python3 - <<'PY'
import os
import secrets
from pathlib import Path

ip = os.environ['PUBLIC_IP']
values = {
    'PUBLIC_IP': ip,
    'DJANGO_SECRET_KEY': secrets.token_urlsafe(64),
    'DJANGO_DEBUG': '0',
    'NELSON_ENVIRONMENT': 'testing',
    'DJANGO_ALLOWED_HOSTS': f'{ip},localhost,127.0.0.1',
    'NELSON_APP_URL': f'https://{ip}',
    'NELSON_TRUSTED_PROXY_IPS': '172.30.42.1',
    'POSTGRES_DB': 'nelson_test',
    'POSTGRES_USER': 'nelson',
    'POSTGRES_PASSWORD': secrets.token_urlsafe(32),
    'NELSON_REVIEW_PASSWORD': secrets.token_urlsafe(24),
    'DEFAULT_FROM_EMAIL': 'noreply@nelson.test',
}
path = Path('/srv/nelson/shared/app.env')
path.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
path.chmod(0o600)
PY
fi
if [[ ! -f /etc/nginx/sites-available/nelson-test ]]; then
cat > /etc/nginx/sites-available/nelson-test <<EOF
server {
    listen 80;
    server_name $public_ip;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 503; }
}
EOF
fi
ln -sfn /etc/nginx/sites-available/nelson-test /etc/nginx/sites-enabled/nelson-test
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
if [[ ! -x /opt/certbot/bin/certbot ]]; then
    python3 -m venv /opt/certbot
    /opt/certbot/bin/pip install 'certbot>=5.4,<6'
fi
/opt/certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
    --preferred-profile shortlived --webroot --webroot-path /var/www/acme \
    --ip-address "$public_ip" --cert-name nelson-test --keep-until-expiring
cat > /etc/systemd/system/nelson-cert-renew.service <<'EOF'
[Unit]
Description=Renew the Nelson testing IP certificate
[Service]
Type=oneshot
ExecStart=/opt/certbot/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
cat > /etc/systemd/system/nelson-cert-renew.timer <<'EOF'
[Unit]
Description=Check the short-lived certificate twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=1800
Persistent=true
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/nelson-maintenance.service <<'EOF'
[Unit]
Description=Clean expired tokens/photos and back up testing data
[Service]
Type=oneshot
ExecStart=/bin/bash /srv/nelson/current/deploy/maintenance.sh
EOF
cat > /etc/systemd/system/nelson-maintenance.timer <<'EOF'
[Unit]
Description=Daily Nelson testing maintenance
[Timer]
OnCalendar=daily
RandomizedDelaySec=1800
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now nelson-cert-renew.timer
echo "Testing host ready for a release: $public_ip"

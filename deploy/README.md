# DigitalOcean testing environment

One Ubuntu 24.04 Droplet runs Nginx, Gunicorn, the activity worker, PostgreSQL 17 and a private Mailpit test inbox. Nginx serves the frontend and proxies `/api` on the same trusted HTTPS IP origin. The application container runs as a non-root user. Production email remains deferred.

## Deployment pipeline

`deploy-test.yml` runs on `main` and the current `codex/tool-tracker-api` integration branch, and supports manual dispatch. Remove the integration branch trigger after merging its PR. It calls the reusable quality workflow: PostgreSQL migrations/schema/contracts, backend regressions, repeatable seeding, frontend checks/build and the complete browser suite.

Only a successful gate can build and transfer a release. BuildKit mounts the read-only CleanForce key during dependency installation. The final image contains the backend, installed dependencies and built frontend. Keys, environment files, local uploads and artifacts are excluded from its context. Images transfer over pinned SSH; private dependencies are not published to a public registry or GitHub artifact.

Repository configuration:

- Variable `TEST_DEPLOY_HOST`: the public IP.
- Secrets `CLEANFORCE_DEPLOY_KEY`, `TEST_DEPLOY_SSH_KEY`, `TEST_DEPLOY_KNOWN_HOSTS`, `TEST_REVIEW_PASSWORD`.
- The dedicated pipeline key has deployment administration privileges on this Droplet. Rotate it separately from the administrator key.

Workflow concurrency and a host lock serialize releases. The full commit tags/labels the image, and transferred files have SHA-256 checksums. The release script stops API/worker writes, backs up existing data, applies migrations, verifies scoped constraints and starts the candidate services. Healthy services are promoted together with the frontend. `/__release` reports the running commit. Expect a short maintenance interval during deployments.

The deployed browser check uses real HTTPS, secure sessions, CSRF, SMTP-to-Mailpit, PostgreSQL, private photo bytes and the audit worker. It checks login, signup/invitation/reset and Chromium PWA eligibility. A dedicated account/company owns its test mutations; human review accounts can change without breaking CI's fixture. Physical phone capture/installation remains a device acceptance check.

## Persistent data and recovery

`/srv/nelson/shared/app.env` stores generated secrets with root-only access. PostgreSQL, photos and the test inbox persist under `shared/`, outside releases. Only SSH and web ports are public. PostgreSQL has no host port; API and inbox ports bind to loopback. Nginx overwrites forwarding headers and the API trusts only the fixed Docker gateway for the original client address.

Fingerprint-named frontend assets are retained in a shared directory so an older open tab can load its chunks after deployment. The current frontend and API use the same release.

Daily maintenance cleans expired tokens/unattached photos and saves a PostgreSQL custom-format dump plus photo archive. Fourteen days of host backups are retained. DigitalOcean Droplet backups provide a separate whole-host recovery path; confirm the selected policy in DigitalOcean. Monitor disk usage before pruning old release bundles/images.

An application rollback is valid only when the previous image is compatible with the migrated schema. Otherwise restore the matching database/photo backup during maintenance. Do not blindly reverse migrations. Images, release files and pre-deploy backups are retained for recovery.

## Bootstrap and operations

Create the Droplet with an administrator SSH key. Copy `bootstrap.sh` and a separate pipeline public key to it, then run `sudo bash bootstrap.sh <public-ip> <pipeline-public-key-file>`. Bootstrap installs Docker/Compose, Nginx, the deployment account and Certbot, generates runtime secrets and obtains a short-lived IP certificate. Its renewal timer checks twice daily and reloads Nginx after renewal. Test renewal with `/opt/certbot/bin/certbot renew --dry-run`.

The first release seeds review scenarios using `NELSON_ENVIRONMENT=testing` and debug mode off. Later releases do not reseed. Seeder reruns preserve passwords, policies, edits and custody. Passwords are stored in the private local deployment credentials file and the host environment, never this repository or CI logs.

Host commands:

```sh
cd /srv/nelson
docker compose --env-file shared/app.env --env-file shared/release.env -f current/deploy/compose.yaml ps
docker compose --env-file shared/app.env --env-file shared/release.env -f current/deploy/compose.yaml logs --tail=100 api worker
bash current/deploy/backup.sh
systemctl list-timers 'nelson-*'
```

For test email, tunnel port 8025 through SSH (`ssh -N -L 127.0.0.1:8025:127.0.0.1:8025 <administrator>@<ip>`) and open `http://127.0.0.1:8025`. Account links point to the public HTTPS app. The private inbox does not deliver messages to real recipients.

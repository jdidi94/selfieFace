# Lightsail API deployment

This deployment keeps the storefront and admin apps on Vercel. Lightsail runs the Nest API, PostgreSQL, and Caddy HTTPS proxy on one server for a small test environment.

## Prepare DNS and the server

1. Create a Lightsail Linux instance in `eu-north-1`. A 2 GB plan is a lean starting point for the API and database; use 4 GB if memory pressure appears.
2. Attach a static IP and point `api.chr-consults.com` to it with an A record at the DNS provider for `chr-consults.com`.
3. In the Lightsail firewall, allow TCP 80 and 443 from anywhere. Limit SSH (TCP 22) to your own IP.
4. Install Docker Engine and the Docker Compose plugin on the instance.
5. Clone this repository, then create `.env.lightsail` from `.env.lightsail.example`. Replace all placeholder secrets and Vercel domains. Generate random secrets with `openssl rand -hex 32`; keep `SETTINGS_SECRETS_KEY` exactly 64 hex characters. Run `chmod 600 .env.lightsail` after creating it.

The `.env.lightsail` file is ignored by Git. Keep SES credentials only in that file on the server, and use a dedicated IAM user with the minimum SES send permissions needed for the verified sender. Rotate any access key previously exposed in development logs or chat; do not reuse it here. Until SES production access is approved in `eu-north-1`, only verified recipient addresses can receive mail.

## Start the API

From the repository root on the Lightsail instance:

```sh
docker compose --env-file .env.lightsail -f compose.lightsail.yml build api
docker compose --env-file .env.lightsail -f compose.lightsail.yml up -d postgres
docker compose --env-file .env.lightsail -f compose.lightsail.yml run --rm api ./apps/server/node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
docker compose --env-file .env.lightsail -f compose.lightsail.yml up -d
```

Check `https://api.chr-consults.com/api/health/ready` and the container logs before pointing Vercel at the API.

## Point Vercel to the API

Set these variables in both Vercel projects, then redeploy them so the public API URL is included in each Next.js build:

- `NEXT_PUBLIC_API_URL=https://api.chr-consults.com/api`
- `NEST_API_URL=https://api.chr-consults.com/api`

Set `REVALIDATE_SECRET` in the storefront Vercel project to the same value as on the API. Keep the actual Vercel domains in `CLIENT_URL`, `ADMIN_URL`, and `CORS_ORIGINS` on the API.

## Backups and limitations

- PostgreSQL and uploaded media use persistent Docker volumes on this one instance. Take Lightsail snapshots before schema changes and on a regular schedule.
- This single-server arrangement is for testing: it does not provide database high availability. Customer support file uploads that require ClamAV remain unavailable until a scanner is configured.
- Use `docker compose --env-file .env.lightsail -f compose.lightsail.yml down` to stop services. This preserves volumes. Do not add `-v` unless you intend to delete the database and uploaded media.

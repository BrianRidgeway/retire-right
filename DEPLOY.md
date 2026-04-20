# Deploying to EC2 at `/retirement-planning`

Target: Ubuntu 22.04 / 24.04, Caddy web server, HTTPS via Let's Encrypt, served at `https://YOUR_DOMAIN/retirement-planning/`.

## 0. Prerequisites

- An EC2 instance running Ubuntu 22.04 or 24.04.
- A DNS A record (or AAAA for IPv6) pointing to the instance's public IP.
- Security group inbound rules: TCP 22 (your IP only), 80, 443 (0.0.0.0/0).
- SSH access as a user with sudo. Examples below use `ubuntu@YOUR_HOST`; replace with your actual user and host.

Replace `YOUR_DOMAIN` with your real domain/subdomain and `YOUR_HOST` with the hostname or IP you SSH into.

## 1. Build locally

The `build:deploy` script sets the Vite base path to `/retirement-planning/` so all asset references are correctly prefixed.

```bash
npm ci
npm run build:deploy
```

Output lands in `dist/`. Sanity-check `dist/index.html` — asset `src`/`href` should start with `/retirement-planning/`.

## 2. Push `dist/` to the EC2 instance

One-off copy via rsync (run locally):

```bash
rsync -av --delete dist/ ubuntu@YOUR_HOST:/tmp/retirement-planning/
```

Then, on the EC2 instance, move into the final location:

```bash
ssh ubuntu@YOUR_HOST
sudo mkdir -p /var/www/retirement-planning
sudo rsync -av --delete /tmp/retirement-planning/ /var/www/retirement-planning/
sudo chown -R www-data:www-data /var/www/retirement-planning
```

Rinse and repeat on future deploys.

## 3. Install Caddy on the EC2 instance

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Caddy auto-starts as a systemd service and listens on 80/443.

## 4. Configure Caddy

Edit `/etc/caddy/Caddyfile`:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
YOUR_DOMAIN {
    encode zstd gzip

    # Redirect bare /retirement-planning -> trailing-slash form so the SPA loads.
    redir /retirement-planning /retirement-planning/ 308

    # Serve the SPA. handle_path strips the prefix, so a request for
    # /retirement-planning/assets/x.js is served from /var/www/retirement-planning/assets/x.js
    handle_path /retirement-planning/* {
        root * /var/www/retirement-planning
        file_server
    }

    # Optional: redirect the site root to the app.
    handle / {
        redir /retirement-planning/ 308
    }
}
EOF
```

Substitute your real hostname for `YOUR_DOMAIN`. Then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will obtain a Let's Encrypt certificate on first request for the hostname — the first load may take a few seconds while this happens, then it's cached for ~60 days and auto-renewed.

## 5. Verify

From anywhere:

```bash
curl -sI https://YOUR_DOMAIN/retirement-planning/ | head -5
```

Expected: `HTTP/2 200` plus `content-type: text/html`. Then open `https://YOUR_DOMAIN/retirement-planning/` in a browser — you should see the planner.

If Caddy logs an error, check:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

## 6. Update flow for future changes

On your local machine:

```bash
npm run build:deploy
rsync -av --delete dist/ ubuntu@YOUR_HOST:/tmp/retirement-planning/
ssh ubuntu@YOUR_HOST 'sudo rsync -av --delete /tmp/retirement-planning/ /var/www/retirement-planning/ && sudo chown -R www-data:www-data /var/www/retirement-planning'
```

No Caddy reload needed — it serves the new files on the next request.

## Notes

- **Privacy guarantee still holds.** The server only delivers static JS/CSS/HTML/JSON. All scenario data, calculations, and optimizer runs happen in the user's browser. Nothing is sent back to the EC2 after the initial page load. Save/Load JSON is a browser-side file download/upload, not a server round-trip.
- **No backend required.** This is pure static hosting. If Caddy feels like overkill later, `python3 -m http.server` would also work (minus HTTPS).
- **SPA routing.** This app uses React state for tabs (no client-side router), so `try_files` / index fallback isn't needed. If you ever add React Router, add a `try_files /index.html` fallback inside `handle_path`.

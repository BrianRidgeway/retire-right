# Deploying to EC2 at retireright.app

Target: Ubuntu 22.04 / 24.04, Caddy web server, HTTPS via Let's Encrypt, served at `https://retireright.app/`.

## 0. Prerequisites

- An EC2 instance running Ubuntu 22.04 or 24.04.
- A DNS A record (and optional AAAA) pointing `retireright.app` (and `www.retireright.app`) to the instance's public IP.
- Security group inbound rules: TCP 22 (your IP only), 80, 443 (0.0.0.0/0).
- SSH access as a user with sudo. Examples below use `ubuntu@retireright.app`; replace with your actual user if different.

## 1. Build locally

```bash
npm ci
npm run build:deploy
```

`build:deploy` sets Vite's `--base=/` so assets resolve from the domain root. Output lands in `dist/`.

Sanity check — `dist/index.html` should reference `/assets/...` (not `./assets/...` or `/retirement-planning/assets/...`):

```bash
grep 'assets/index' dist/index.html
```

## 2. Push `dist/` to the EC2 instance

Run locally:

```bash
rsync -av --delete dist/ ubuntu@retireright.app:/tmp/retire-right/
```

Then on the EC2:

```bash
ssh ubuntu@retireright.app
sudo mkdir -p /var/www/retire-right
sudo rsync -av --delete /tmp/retire-right/ /var/www/retire-right/
sudo chown -R caddy:caddy /var/www/retire-right
```

## 3. Install Caddy (one-time)

If Caddy isn't already installed, use the official binary (reliable, no third-party apt repo):

```bash
CADDY_VER=2.8.4
curl -L -o /tmp/caddy.tar.gz "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VER}/caddy_${CADDY_VER}_linux_amd64.tar.gz"
tar -xzf /tmp/caddy.tar.gz -C /tmp caddy
sudo install -m 755 /tmp/caddy /usr/local/bin/caddy
caddy version

sudo useradd --system --home /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy

sudo mkdir -p /etc/caddy
sudo tee /etc/systemd/system/caddy.service >/dev/null <<'EOF'
[Unit]
Description=Caddy
After=network.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable caddy
```

If Apache is installed and squatting on port 80, stop it first:

```bash
sudo systemctl stop apache2 && sudo systemctl disable apache2
```

## 4. Configure Caddy

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
retireright.app, www.retireright.app {
    encode zstd gzip
    root * /var/www/retire-right
    file_server

    # Correct content-types for SEO crawl files.
    @crawl path /robots.txt /sitemap.xml /llms.txt
    header @crawl Cache-Control "public, max-age=3600"

    # Long cache on fingerprinted assets.
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"

    # No cache on index.html so deploys take effect immediately.
    @html path /index.html /
    header @html Cache-Control "no-cache"
}

# Redirect apex <-> www if you prefer one canonical form. Pick one and uncomment:
# www.retireright.app {
#   redir https://retireright.app{uri} permanent
# }
EOF

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl start caddy
sudo systemctl status caddy --no-pager
```

First request takes a few seconds while Caddy provisions the Let's Encrypt certificate. Watch live:

```bash
sudo journalctl -u caddy -f
```

## 5. Verify

```bash
curl -sI https://retireright.app/ | head -5
curl -s https://retireright.app/robots.txt
curl -s https://retireright.app/sitemap.xml
curl -s https://retireright.app/llms.txt
```

All should return 200 (or a proper response). Then open `https://retireright.app/` in a browser. You should land on the marketing page; clicking "Launch planner" takes you to `#app` and boots the SPA.

## 6. Future deploys

```bash
# local
npm run build:deploy
rsync -av --delete dist/ ubuntu@retireright.app:/tmp/retire-right/

# on the server
ssh ubuntu@retireright.app 'sudo rsync -av --delete /tmp/retire-right/ /var/www/retire-right/ && sudo chown -R caddy:caddy /var/www/retire-right'
```

No Caddy reload needed — it serves the new files on the next request.

## Notes

- **SEO.** `/robots.txt`, `/sitemap.xml`, and `/llms.txt` are served as static files. Submit the sitemap in Google Search Console once DNS propagates.
- **Privacy guarantee.** Server only delivers static JS/CSS/HTML/JSON. All planning math runs client-side after the page loads. No backend required.
- **Fingerprinted assets.** Vite emits hashed filenames (e.g. `index-abc123.js`), so long `Cache-Control` is safe — new deploys produce new filenames and `index.html` (with `no-cache`) picks them up on the next page load.

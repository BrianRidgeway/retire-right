# Deploying Retire Right

Primary target: **Cloudflare Pages** at `https://retireright.app/`. Pages is free for personal projects, serves from a global CDN, handles TLS automatically, and rebuilds on every git push (if you use the GitHub integration).

Two paths below - pick one:

- **Path A: GitHub + Pages git integration** (recommended once the repo exists - zero-touch auto-deploys)
- **Path B: Direct upload via `wrangler`** (works today without a repo)

Both require Cloudflare managing DNS for `retireright.app`. That's in section 0.

## 0. Move DNS to Cloudflare (one-time)

1. Sign in to Cloudflare → **Websites → Add a site** → enter `retireright.app`.
2. Pick the Free plan.
3. Cloudflare will import whatever A / MX / TXT records it can see and give you two nameservers like `foo.ns.cloudflare.com`, `bar.ns.cloudflare.com`.
4. At your domain registrar (where you bought `retireright.app`), replace the existing nameservers with those two. Save. Propagation typically 5 min–24 hr.
5. Once Cloudflare shows the zone as "Active," proceed.

## Path A: GitHub + Cloudflare Pages

**One-time setup:**

1. Push this repo to GitHub:
   ```bash
   gh repo create retire-right --public --source=. --remote=origin --push
   ```
   (or create the repo manually and `git push -u origin main`).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the `retire-right` repo.
4. Build settings:
   - Framework preset: **None** (Vite is not in the preset list, but the manual settings below work)
   - Build command: `npm run build:deploy`
   - Build output directory: `dist`
   - Node version: `20` or later (set under **Variables → Environment variables** as `NODE_VERSION=20`)
5. Save and deploy. First deploy gives you a `*.pages.dev` URL.

**Attach the custom domain:**

6. In the Pages project → **Custom domains → Set up a custom domain** → `retireright.app`. Cloudflare creates the DNS records automatically. Add `www.retireright.app` the same way if you want both.
7. Cloudflare provisions a cert. A minute later, `https://retireright.app/` is live.

**Future deploys:** push to `main`. Pages builds and deploys automatically within ~60 seconds.

## Path B: Direct upload via `wrangler`

Use this before you have a GitHub repo, or for one-off deploys.

**One-time setup:**

1. Log in to Cloudflare via wrangler (opens a browser):
   ```bash
   npx wrangler login
   ```
2. Create the Pages project (first deploy does this implicitly, but you can also create it in the dashboard):
   ```bash
   npx wrangler pages project create retire-right --production-branch=main
   ```
3. Attach the custom domain in the dashboard → Pages project → **Custom domains** → add `retireright.app`.

**Deploy:**

```bash
npm run deploy
```

That runs `build:deploy` then `wrangler pages deploy dist --project-name=retire-right`. First deploy prints the `*.pages.dev` URL; subsequent deploys overwrite production within seconds.

## Cache and security headers

`public/_headers` is served by Pages verbatim. It sets:

- `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` - safe because Vite emits fingerprinted filenames per build.
- `Cache-Control: no-cache, must-revalidate` on `/` and `/index.html` - deploys appear on the next page load.
- Hourly cache on `/robots.txt`, `/sitemap.xml`, `/llms.txt`.
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` applied site-wide.

Edit `public/_headers` and redeploy to change cache or security policy. No Cloudflare dashboard toggles needed.

## Verify

```bash
curl -sI https://retireright.app/ | head -8
curl -s https://retireright.app/robots.txt
curl -s https://retireright.app/llms.txt | head -5
```

Expect `HTTP/2 200`, `content-type: text/html`, and `cf-ray` / `server: cloudflare` response headers. Open the site in a browser - you should land on the marketing page; clicking "Launch planner" navigates to `/#app` and boots the SPA.

## SEO follow-ups (one-time)

- **Google Search Console** → Add property → `https://retireright.app/` → verify via the DNS TXT record (Cloudflare makes this trivial) → submit `https://retireright.app/sitemap.xml`.
- **Bing Webmaster Tools** → same flow.
- **IndexNow** (optional): Cloudflare has a one-click IndexNow integration that pings search engines on every deploy.

## Appendix: the old EC2 + Caddy path

The earlier EC2/Caddy setup still works and is documented in git history (commit `91542e8` and before). Once Cloudflare Pages is serving the domain, you can either keep EC2 running for something else or stop the instance. If you ever want to move back, see the git history for the Caddyfile and systemd unit.

## Privacy guarantee still holds

Cloudflare Pages only serves static JS/CSS/HTML/JSON. No server-side code runs, no user data is received or stored. All planning calculations happen in the visitor's browser after the page loads, just as before. The trade-off vs self-hosted: Cloudflare sees request logs (IP, user-agent, path) as it proxies the CDN - standard for any CDN-fronted site. Pages does not inject analytics or tracking.

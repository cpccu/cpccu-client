# Deployment Guide

This document describes how the CPCCU platform is deployed in production.

| App | Repository | Host | Production URL |
| --- | --- | --- | --- |
| Frontend + API | `cpccu/cpccu-client` | **Vercel** | https://cpccu.club/ |

There is **one** deployment. The pages and the API are the same Next.js application: the API is mounted at `/api/v1` inside it and reached same-origin, with a relative base path and no second host. That means there is no CORS to configure, no second service to keep alive, and no API base URL to repoint when a hostname changes.

---

## 1. Application — Vercel

The app is deployed on Vercel with automatic deployments from the git provider (push to `main`/`release` triggers production).

### 1.1 Project Configuration

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js (auto-detected from `package.json`) |
| Build Command | `npm run build` (or `bun run build`) |
| Output Directory | `.next` (default; `output: "export"` is commented out in `next.config.mjs`) |
| Install Command | `npm install` (or `bun install`) |
| Node Version | 20.9+ (Next.js 16 `engines` requirement) |

`next.config.mjs` sets `reactStrictMode: true` and allows image optimization for exactly two remote hosts (`res.cloudinary.com` and `avatars.githubusercontent.com`) via `images.remotePatterns`. Do not widen it back to a wildcard — that is a real SSRF surface, and the narrowing is recorded in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §5.14.

> ⚠️ **This must be a standard Next.js server build, not a static export.** `output: "export"` is commented out deliberately. The `/api/v1` route handlers and the certificate metadata generation both need a Node runtime, and several controls in the server foundation are only sound behind the Vercel edge (see §1.6).

### 1.2 Environment Variables (Vercel)

Set these in the Vercel project dashboard (**Settings → Environment Variables**). [`.env.sample`](../.env.sample) is the authoritative list and documents each one inline.

**Required — nothing authenticates or persists without these four.** `src/lib/server/env.js` validates exactly this set, lazily, on first use, and throws one aggregated error naming every missing variable.

| Variable | Value (production) | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Atlas connection string | The database |
| `ACCESS_TOKEN_SECRET` | `openssl rand -base64 48` | Signs the access token |
| `REFRESH_TOKEN_SECRET` | a **different** `openssl rand -base64 48` | Signs the refresh token |
| `PASSWORD_TOKEN_SECRET` | a **different** `openssl rand -base64 48` | Signs the password-reset `code`/`token` pair |

> ⚠️ A deployment with none of these set **builds green and fails at runtime.** `validateEnv()` is deliberately not called at module load — a top-level throw would fail `next build` for every route, including ones that never touch auth. The observable symptom is authenticated routes returning **500, not 401**, and every login failing with an error that names the missing variables.

**Required for the app to be usable — the origins.** These seed the CSRF origin allow-list in `src/lib/server/request.js`, and getting them wrong **403s every unsafe method** while reads keep working.

| Variable | Value (production) | Purpose |
| --- | --- | --- |
| `WEB_DOMAIN` | `https://cpccu.club` — **bare origin, scheme, no trailing slash** | Password-reset link host **and** a CSRF allow-list seed |
| `NEXT_PUBLIC_SITE_URL` | `https://cpccu.club` | CSRF allow-list seed; the `www.` sibling is added automatically |
| `EXTRA_ALLOWED_ORIGINS` | *(empty unless needed)* | Comma-separated extra hosts (staging, preview). **Additive only** |

> ⚠️ `NEXT_PUBLIC_*` values are **inlined at build time** on Vercel — changing one requires a **rebuild**, and editing the dashboard alone does not affect any already-built bundle. Do **not** prefix backend-only secrets with `NEXT_PUBLIC_`.
>
> `NEXT_PUBLIC_SITE_URL` is the only `NEXT_PUBLIC_*` variable that remains, and it is **not** an API URL. The base path is the hard-coded relative literal `/api/v1` (`src/services/baseApi.js`); there is no base-URL variable to set.

**Required per enabled feature**

| Variable | Purpose |
| --- | --- |
| `ACCESS_TOKEN_EXPIRE`, `REFRESH_TOKEN_EXPIRE`, `PASSWORD_TOKEN_EXPIRE` | Token lifetimes. `ACCESS_TOKEN_EXPIRE` is load-bearing — the transparent-refresh path only works because the access token is short-lived, so removing it or setting it huge turns "users are silently refreshed" into "every user is hard-logged-out". |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` | All image uploads. The three credentials are required together and validated on first call, so a missing one fails that one request rather than the build. |
| `RESEND_API_KEY` | OTP, password-reset and welcome mail. The sending domain (`noreply@cpccu.club`) must be verified in the Resend account. |
| `CONTRIBUTOR_GITHUB_TOKEN` | The admin contributor sync. Must be a **fine-grained** PAT scoped to `cpccu/cpccu-client` and the single path `data/contributors.json`, Contents read/write and nothing else. |
| `GOOGLE_SHEETS_API_KEY`, `BOOTCAMP_SHEET_ID` | The bootcamp leaderboard. Needed together; the page shows a hint without them. |
| `VERBOSE_ERRORS` | Normally empty (follows the `NODE_ENV` default). `true` forces raw error messages on a production host — the live-debug escape hatch, and deliberately the more dangerous setting. `false` forces redaction on a host not reporting itself as production. |

Do **not** set `NODE_ENV` by hand: Next inlines `production` at build time and the platform sets it at runtime.

> `CONTRIBUTOR_GITHUB_TOKEN` uses the same secret name as the `update-contributors.yml` workflow, which is intentional.

### 1.3 Security Headers

- `src/proxy.ts` (Next.js 16 proxy) applies CSP (production only), `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `Permissions-Policy`, and COOP/COEP/CORP headers on every route except `_next/static` and `_next/image`.
- HSTS is applied automatically because the Vercel hostname is not `localhost`.
- The API responses additionally get `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` from the route-handler wrapper (`src/lib/server/http.js`), which is the only source of `nosniff` on an API response.

### 1.4 Redirects

- `public/_redirects` exists for static-hosting redirects; on Vercel, use the `vercel.json`/framework redirects instead.
- Legacy certificate route: `/verify/[certificateId]` redirects to `/certificate/[certificateId]` (handled in the app router, no config needed).
- `next.config.mjs` declares no `rewrites` or `redirects` touching `/api`. This is load-bearing: the admin authorisation layer derives its resource from the **absolute, unrewritten** pathname, and a stripped pathname silently denies moderator writes while leaving admins unaffected.

### 1.5 Legacy Files (ignored on Vercel)

- `.htaccess` — Apache rewrite rules from the even older static/`out` deployment; unused by Vercel.
- `public/_redirects` — Netlify-style redirects; unused by Vercel.
- `render.yaml` / `_render.yaml` were **Render** deploy blueprints from an earlier Render-based frontend deployment. They are **deleted, on purpose** — the platform is Vercel, and a Render blueprint in the tree describes an ingress that does not exist. Do not restore them. See [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §10.3.1.

### 1.6 Hard platform constraint: this API must run behind the Vercel edge

Every IP-derived control — all nine rate limiters, including `loginRateLimiter` (10 / 15 min) — takes its client identity from `getClientIp` in `src/lib/server/request.js`, which reads `x-real-ip`, then `x-vercel-forwarded-for`, then the rightmost `x-forwarded-for`, and never a socket address (App Router has no socket). That is correct on Vercel, where the edge **overwrites** those headers on every request. It is correct on **no other host**: behind a bare Node process, a container, a VM, a reverse proxy or a self-hosted preview, all three are ordinary client-supplied fields, and two requests with different `x-real-ip` values defeat every IP-keyed limiter simultaneously.

**If this application is ever hosted anywhere but Vercel, `getClientIp` must be rewritten first.** The full reasoning, the blast radius, and the edge-rate-limit alternative are in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8.

> Separately and independently: the default rate-limit store is an in-process `Map`, which is **not** shared across Vercel instances, so the limiters enforce only intermittently and fail silently. The recommended mitigation is a Vercel Firewall rate-limit rule, not a new application dependency. See §8.1 of that document before declaring a deploy fully hardened.

---

## 2. Development / Local Setup

1. Clone the repo and install dependencies (`npm install` or `bun install`).
2. Create your env file and fill in at least the four hard-required variables plus `WEB_DOMAIN` / `NEXT_PUBLIC_SITE_URL`:
   ```bash
   cp .env.sample .env
   ```
   (Use `.env`, not `.env.local`: `.gitignore` covers exactly `.env`, so a `.env.local` would be committable with your secrets in it.)
3. Point `MONGODB_URI` at a local or Atlas database. Most public pages fall back to `data/*.json`, so an empty database looks like a working site — do not mistake it for a successful seed.
4. Start the app: `npm run dev`. Pages and API are both on `http://localhost:3000`; the API health probe is `http://localhost:3000/api/v1`.
5. `npm test` and `npm run lint` are the fast checks; `npm run build` is the full one.

There is no second service to start. The `localhost:3000`–`3002` origins are compiled into the CSRF allow-list, so a dev server on the default port needs no origin configuration.

---

## 3. Production URLs

| Purpose | URL |
| --- | --- |
| Production site | https://cpccu.club/ |
| Frontend metadata base | https://www.cpccu.club (set in `src/app/layout.jsx`) |
| API | Same origin — `https://cpccu.club/api/v1` (reached by the client as the relative `/api/v1`) |
| API health probe | `GET https://cpccu.club/api/v1` — plain-text heartbeat |

---

## 4. Post-deploy smoke test

Run these in order; the first three are the ones that fail *silently* or *misleadingly*.

- [ ] `GET /api/v1` returns the plain-text heartbeat. This proves the route handlers deployed at all.
- [ ] One public `GET` returns real data (e.g. `GET /api/v1/content/events`).
- [ ] Log in, and confirm a `POST` succeeds — **this is the CSRF check**. A `403 Cross-origin request rejected` on every write means `WEB_DOMAIN` / `NEXT_PUBLIC_SITE_URL` is wrong, not that the request was malformed. See §1.2.
- [ ] `GET /api/v1/users/user` returns 200 for the signed-in browser. A 401 here is what "not logged in" means to the whole app.
- [ ] One multipart upload succeeds (proves the Cloudinary credentials and the 4 MiB body cap).
- [ ] `npm test` and `npm run lint` pass locally against the same commit.

---

## 5. Related documents

- [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) — how the API came into this repository, the full env-var reference, and the pre-deploy checklist.
- [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) — local setup from scratch.
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — what to check when a deploy misbehaves.
- [SECURITY.md](./SECURITY.md) — the security posture, including the auth model.

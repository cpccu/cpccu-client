# Developer Onboarding

*"I just joined the CPCCU development team. What do I do?"*

This guide gets you from zero to running the CPCCU site locally and understanding where everything lives. Read it top to bottom once — then use [ARCHITECTURE.md](./ARCHITECTURE.md) and the [Documentation Index](./README.md) as references.

---

## 1. Project overview

**CPCCU** (Competitive Programming Camp City University) is the official web portal of the CPCCU club at City University. The platform has:

- A **public site** (homepage, members, profiles, certificates, events, gallery, contributors, job pipeline, bootcamp leaderboard, …)
- An **admin panel** (`/admin`) with role-based access for club officers
- An **API** that is part of this same application — 65 endpoints in 53 Next.js App Router route handlers under `src/app/api/**`

Live site: https://cpccu.club/

## 2. Repository overview

**There is one repository, and it contains the whole application.**

| Repo | Role | Host |
| :--- | :--- | :--- |
| `cpccu/cpccu-client` (**this repo**) | The entire platform: UI, routing, state, **and** the API | Vercel |

The API used to be a separate Express app in a second repository. It was migrated into this one and the frontend was cut over to it, so **the client calls its own origin**: the base path is the hard-coded relative literal `/api/v1` (`src/services/baseApi.js`). There is no second process to start and no API base URL to configure.

The old backend repository, `cpccu-server`, still exists and is a useful read-only reference for *why* the ported code looks the way it does. It is not part of this application's build, its dev loop, or its runtime, and nothing here tells you to run it. See [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) for the handover record and [ADR.md](./ADR.md) for the decisions behind the migration.

## 3. Prerequisites

- **Node.js v20.9+** (required by Next.js 16)
- **npm** (or [Bun](https://bun.sh/))
- A **MongoDB** instance — local `mongod` or an Atlas connection string. Everything that renders live data needs it.
- A GitHub account (for contributing)

## 4. Clone & setup

```bash
git clone https://github.com/cpccu/cpccu-client.git
cd cpccu-client
npm install        # or: bun install
```

Then create your environment file — see §5. Nothing else is needed to get a running app.

## 5. Environment variables

Copy `.env.sample` to `.env` and fill it in. `.env.sample` is a real, loadable dotenv file in which every variable is written as `KEY=` with an empty value, and its inline comments are the authoritative description of each one.

```bash
cp .env.sample .env
```

> ⚠️ **Use `.env`, and check `git status` before you commit.** `.gitignore` ignores exactly `.env` — it does **not** ignore `.env.local`, `.env.development` or any other `.env*` variant, so those would be committable with your secrets in them. If you prefer `.env.local`, add `.env*.local` to `.gitignore` first. No secret in `.env.sample` has a default value, deliberately: a value a developer can copy out of a committed file is a value that ships.

### 5.1 The four hard-required variables

`src/lib/server/env.js` validates exactly these, and a request that needs a missing one fails with an error that names it. There is no build-time check — `validateEnv()` runs lazily, on first use — so **a deploy with these unset builds green and fails at runtime**, and the symptom is that every login 500s rather than "the deploy is misconfigured".

| Variable | Why it is required |
| :--- | :--- |
| `ACCESS_TOKEN_SECRET` | Signs the access token. |
| `REFRESH_TOKEN_SECRET` | Signs the refresh token. |
| `PASSWORD_TOKEN_SECRET` | Signs the password-reset `code`/`token` pair. |
| `MONGODB_URI` | Without it `db.js` string-concatenates into the nonsense host `"undefined/CPCCU"` and the failure surfaces as a DNS error pointing nowhere near the cause. |

Each secret must be a long random string and each must be **different** from the others — reusing one key across three token types means a token minted for one purpose verifies for the others. Generate one with:

```bash
openssl rand -base64 48
```

### 5.2 The origins — the second thing to get right, and the quieter failure

`WEB_DOMAIN` and `NEXT_PUBLIC_SITE_URL` seed the **CSRF origin allow-list** in `src/lib/server/request.js`. Every unsafe method (`POST`/`PUT`/`PATCH`/`DELETE`) is checked against it, so a wrong or missing value **403s every write in the app** while reads keep working — login, registration, profile edits, uploads, the lot.

| Variable | Purpose |
| :--- | :--- |
| `WEB_DOMAIN` | **Bare origin, scheme included, no trailing slash** (e.g. `https://cpccu.club`). Used for two things: building the host of a password-reset link, and seeding the CSRF allow-list. |
| `NEXT_PUBLIC_SITE_URL` | A single origin, used as a seed for the CSRF allow-list. The apex and `www.` siblings of whatever you supply are added automatically, so listing only one half of a pair is not a mistake. It is **not** an API URL. |
| `EXTRA_ALLOWED_ORIGINS` | Comma-separated, for hosts that are genuinely neither (staging, preview). **Additive only** — it cannot remove a configured domain. |

The `localhost:3000`–`3002` dev origins are compiled in, so a local dev server on the default port needs none of this to be right. The first thing to check on any fresh deploy that "loads but nothing saves" is these two values.

> ⚠️ `NEXT_PUBLIC_*` values are **inlined at build time**, not read at runtime. Changing one requires a rebuild — editing the variable in the platform's dashboard does not affect any already-built bundle. Only `NEXT_PUBLIC_SITE_URL` remains, and only the server reads it.

### 5.3 Everything else, and what needs it

| Group | Variables | Needed for |
| :--- | :--- | :--- |
| Auth token lifetimes | `ACCESS_TOKEN_EXPIRE`, `REFRESH_TOKEN_EXPIRE`, `PASSWORD_TOKEN_EXPIRE` | Anything that signs a token. `ACCESS_TOKEN_EXPIRE` is load-bearing: the transparent-refresh path only works because the access token is short-lived, so setting it huge turns "users are silently refreshed" into "every user is hard-logged-out". |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` | Every image upload (profile, admin, posts). All three credentials are required together; validated on first call, so a missing one fails the one request that needs it rather than the build. |
| Transactional email | `RESEND_API_KEY` | Registration OTPs, password-reset mail, welcome mail. The Resend client is constructed lazily so a missing key cannot break a module import. The sending domain (`noreply@cpccu.club`) must be verified in the Resend account. |
| Error reporting | `VERBOSE_ERRORS` | Normally empty, which follows the `NODE_ENV` default (redact raw messages in production). Set `true` to force raw messages on a production host for live debugging; set `false` to force redaction on a host not reporting itself as production. |
| Contributors | `CONTRIBUTOR_GITHUB_TOKEN` | The admin contributor sync. Must be a **fine-grained** PAT scoped to one repo and one path (`data/contributors.json`), with Contents read/write and nothing else. |
| Bootcamp leaderboard | `GOOGLE_SHEETS_API_KEY`, `BOOTCAMP_SHEET_ID` | The leaderboard page. Needed together; without them the page shows a hint. |

Do not set `NODE_ENV` by hand — Next sets it at build time and the platform sets it at runtime. Use `VERBOSE_ERRORS` to control error detail on a real host.

## 6. Run the app

```bash
npm run dev        # http://localhost:3000 — pages and API together
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint (flat config, eslint.config.mjs)
npm test           # node --test over test/*.test.js
```

## 7. The API is served by this app

There is no backend process. Requests go to the same origin the pages came from:

```
Browser ──► https://cpccu.club/api/v1/…  ──► src/app/api/v1/…/route.js
```

- **Base path**: `/api/v1`, a hard-coded relative literal in `src/services/baseApi.js`. There is no environment variable for it and adding one back is deliberately hard — see that file's comment block and `test/client-endpoint-parity.test.js`, which asserts no `process.env` read exists there.
- **The same origin is load-bearing, not cosmetic.** The session is an `httpOnly` cookie scoped to this host and the CSRF check reasons in terms of one origin. Pointing the client at a second host is a design change, not a configuration change.
- **No CORS to configure.** The browser never makes a cross-origin API request, so there is no allow-list to keep in sync and no preflight to satisfy. CSRF is handled in-process instead, by `assertSameOrigin` in `src/lib/server/request.js`.
- **Server-side calls skip HTTP entirely.** `src/lib/certificate-metadata.js` reads the database through `src/lib/server/services/certificate.service.js` rather than fetching its own origin.

> ⚠️ **Deploy on Vercel, or rewrite `getClientIp` first.** Every IP-derived rate limiter reads the client address from `x-real-ip` / `x-vercel-forwarded-for` / `x-forwarded-for`, which are only trustworthy because the Vercel edge overwrites them. Behind any other host all three are ordinary client-supplied fields, and one request with a forged header defeats every IP-keyed limiter at once. The reasoning is in `src/lib/server/request.js` and in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8.2.

## 8. Same-origin: how the client reaches the API

- `baseApi` uses a relative `baseUrl` and `credentials: 'include'`, so the browser attaches the `httpOnly` session cookies automatically. No token is read, stored or sent by the client.
- Direct `fetch` call sites use the same relative literal: `VisitorCounter.jsx` (`/api/v1/visitor`) and `BootcampLeaderboard.jsx` (`/api/v1/bootcamp-leaderboard`).
- The API is **auth-by-default**: a route is authenticated unless it declares `public: true`, and nothing in the admin surface is public.
- `GET /api/v1` is the health probe — `public`, and a plain-text heartbeat. It is the quickest way to confirm the route handlers built and are being served.
- The full endpoint table, with per-route auth and rate limiting, is in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §3.

## 9. Database requirements

- MongoDB (local or Atlas), via `MONGODB_URI`.
- Collections start empty on a fresh database, and most public pages fall back to the JSON files in `data/`, so an empty database looks like a working site rather than a broken one.
- **There is no seed script in this repository.** The JSON→Mongo seeder (`npm run data:seed`) exists only in the archived `cpccu-server` repo and has not been ported; it is a known gap, not part of the setup you need to run the app.

## 10. External services

| Service | Used for | Owner |
| :--- | :--- | :--- |
| Resend | OTP / reset / welcome emails | this app (server-side) |
| Cloudinary | Image uploads | this app (server-side) |
| GitHub API | Contributor sync (Actions + admin write-back) | both |
| Google Sheets | Bootcamp leaderboard | this app (server-side) |

You can develop without Resend or Cloudinary — the features that need them show a hint or an error. You cannot develop without MongoDB.

## 11. Authentication testing

The session is the `httpOnly` cookie. The client holds no token, and `GET /api/v1/users/user` is the only authority on who is signed in.

1. **Register** at `/signup` — an email OTP is sent. Locally you can read the HTML from the Resend call in the server log.
2. **Verify** in the popup → account becomes `isValid: true`, welcome email fires.
3. **Login** at `/login` — the response body carries only `{ user }`; the tokens are set as cookies.
4. Try logging in **before** verifying → expect `403 EMAIL_NOT_VERIFIED` and the OTP popup reopening. This is server-enforced verification — don't "fix" it client-side.
5. Confirm a session by loading the site: `ProviderWrapper` calls `GET /api/v1/users/user` on every page load. A 401 there is what "not logged in" means.

Useful URLs: `/login`, `/signup`, `/reset-password/[code]/[token]`, `/profile/[uniID]`, `/admin` (admin/moderator/mentor roles only).

## 12. Useful routes

| Route | What it is |
| :--- | :--- |
| `/` | Homepage |
| `/member` | Public member directory |
| `/profile/[id]` | Public profile (also `/users/profile/[id]`) |
| `/certificate`, `/certificate/[certificateId]` | Certificate verification portal |
| `/contributors` | Contributors page |
| `/job-pipeline` | Approved developer profiles |
| `/event`, `/gallery`, `/committee`, `/alumni`, `/blog`, `/contact`, `/history`, `/bootcamp-leaderboard` | Content pages |
| `/admin/*` | Admin panel |
| `/api/v1` | API health probe (`text/html`) |

## 13. Testing

**There is a test suite, and it is the fastest check you have.**

```bash
npm test
npm run lint
npm run build
```

`npm test` runs `node --test` over `test/*.test.js` with no test-framework dependency. It covers the server foundation (`admin-auth`, `handler`, `errors`, `response-envelopes`, `pure-helpers`, `csrf`, `client-ip`, `anonymous-projections`, `loader`) plus two files that guard the client/server seam specifically:

- `test/client-endpoint-parity.test.js` — every URL the client declares must resolve to a real `route.js` answering that method, `baseApi.js`'s base path must be exactly `/api/v1`, `baseApi.js` must read no `process.env` at all, and no file under `src/` may contain a retired backend origin. **Run this whenever you add, rename or re-method an endpoint on either side.**
- `test/route-method-declaration.test.js` — each route file's `defineRoute('…')` method agrees with its `export const` name.

`npm run lint` runs ESLint over the repo with the flat config in `eslint.config.mjs`.

## 14. Build

```bash
npm run build && npm run start
```

`next.config.mjs` keeps `output: "export"` commented out — the app deploys as a standard Next.js server build on Vercel. This matters: the app is a server, not a static export, because the API route handlers and the certificate metadata generation need a Node runtime.

## 15. Debugging

- **Network tab**: all API traffic is same-origin, under `/api/v1`. The session rides in the cookie, so the `Cookie` column is the thing to look at, not an `Authorization` header — there isn't one.
- **A failing auth check is `GET /api/v1/users/user` returning 401.** That single request is how the app decides whether anyone is signed in; `ProviderWrapper` dispatches `clearCredentials` on it. If everything renders logged out, debug that request.
- **On a deploy, check the CSRF allow-list first** (`WEB_DOMAIN` / `NEXT_PUBLIC_SITE_URL`, §5.2). A wrong value there 403s every unsafe method, so the site looks alive and nothing saves.
- **Redux DevTools**: RTK Query cache + auth state under `state.api` / `state.auth`. `state.auth.user` is a **cache** of what `GET /users/user` last returned, never proof of a session.
- **Server logs**: the route handlers log to the same terminal as `next dev`.
- If pages show fallback JSON instead of live data, the corresponding Mongo collection is empty or the request failed (check the Network tab).

## 16. Deployment basics

- Single origin on **Vercel** (production https://cpccu.club/). See [DEPLOYMENT.md](./DEPLOYMENT.md).
- Set the four hard-required secrets plus the feature-specific variables in **Settings → Environment Variables**. Remember `NEXT_PUBLIC_SITE_URL` is inlined at build time, so changing it needs a redeploy.
- No CORS configuration and no second service to deploy.
- The contributor GitHub Action runs on the `release` branch — don't expect contributor changes from a `dev`-only PR.

## 17. Contribution workflow

1. Branch from `dev`: `git checkout -b feat-{name}` (or `fix-`, `refactor-`, `chore-`).
2. Make your change; run `npm test`, `npm run lint` and `npm run build` to verify it.
3. Push and open a PR to `dev` with a clear description.
4. If your change alters an API contract, the auth model, env vars, or architecture, update the relevant docs (see [CONTRIBUTION.md](./CONTRIBUTION.md)). Endpoint changes on **either** side need the parity test to stay green.

## 18. Code organization (where do I go for X?)

| I want to change… | Look here |
| :--- | :--- |
| Login / signup / OTP | `src/app/login`, `src/app/signup`, `src/components/LOGINSIGNUP/`, `src/components/ALERT/OtpVerifyPopup.js` |
| Auth state / session hydration | `src/features/auth/`, `src/app/redux/` |
| The client's API layer (base URL, tags) | `src/services/baseApi.js` |
| The endpoints the app calls | `src/features/*/*Api.js` |
| **Add or change an API endpoint** | `src/app/api/v1/**/route.js` (a `defineRoute` declaration) → `src/lib/server/controllers/*.js` (business logic) |
| Auth enforcement, CSRF, IP, cookies, body limits | `src/lib/server/auth.js`, `request.js`, `http.js` |
| Rate limits | `src/lib/server/rateLimit.js` |
| Env var validation | `src/lib/server/env.js` (the required list), `.env.sample` (the documentation) |
| Profile page | `src/app/(main)/profile/[id]`, `src/components/Layout/Profile.jsx`, `src/components/PROFILE/` |
| Certificate verification | `src/app/(main)/certificate/`, `src/features/certificate/`, `src/components/CERTIFICATE/`, `src/lib/certificates/` |
| Admin panel | `src/app/admin/`, `src/components/admin-layout.jsx`, `src/components/admin-sidebar.jsx`, `src/components/*-content.jsx`, `src/features/admin/adminApi.js` |
| Contributors (GitHub-synced) | `src/components/contributors-content.jsx`, `src/features/admin/adminApi.js`, `data/contributors.json`, `scripts/update_contributors.py`, `.github/workflows/update-contributors.yml` |
| Static/fallback content | `data/*.json` |
| Security headers | `src/proxy.ts` |
| Shared UI | `src/components/ui/` (Radix/shadcn-style) |

## 19. Common mistakes

- **Forgot the four required secrets** → every authenticated route 500s, and login returns a 500 rather than a 401. The error text names the missing variables. `validateEnv()` is lazy, so the build is green; this is expected, not a bug.
- **`WEB_DOMAIN` / `NEXT_PUBLIC_SITE_URL` wrong or missing** → every `POST`/`PATCH`/`DELETE` is 403 `Cross-origin request rejected`, while reads still work. `WEB_DOMAIN` must be the bare origin with the scheme and no trailing slash.
- **Changed a `NEXT_PUBLIC_*` value and nothing happened** → it is inlined at build time. Restart `npm run dev` locally; redeploy in production.
- **Added a `process.env` read for the API URL** → don't. The base path is `/api/v1` on purpose, and `test/client-endpoint-parity.test.js` fails if one appears in `baseApi.js`.
- **Logging in before verifying email** → you get `EMAIL_NOT_VERIFIED`; verify via the popup first.
- **Looks logged out on every page load** → check whether `GET /api/v1/users/user` is 401ing. That request, not Redux and not `localStorage`, is the authority on session identity.
- **Editing contributors** → only `batch`/`linkedin` are editable; the server needs `CONTRIBUTOR_GITHUB_TOKEN`.
- **Contributor data not updating** → the workflow only runs on the `release` branch (daily + manual dispatch).
- **Empty database looks like a bug but isn't** → most public pages fall back to `data/*.json`. No seeder exists in this repo (§9).
- **Unused files are real** — `rootReducer.js`, `userSlice.js`, `memberSlice.js`, `postSlice.js`, `postApi.js`, `Profile1.jsx`, legacy `PROFILE` components, `AdminPanel.jsx`, and the dead `createUser`/`deleteUser`/`fetchMemberById` endpoints are leftovers; don't rely on them (see [ARCHITECTURE.md](./ARCHITECTURE.md#18-current-notes-and-inconsistencies)).

## 20. Next steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) — the detailed map of the frontend.
2. Read [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) — how the API got into this repository, what the route handlers and the server foundation do, and the one security topic you should not skip (§8, rate limiting).
3. Read [ADR.md](./ADR.md) for the reasoning behind the decisions, including the superseded ones.
4. Pick a small issue, branch from `dev`, and open a PR.

# Security

This document describes the **actual** security posture of the CPCCU frontend (`cpccu-client`) and the security-relevant behavior of the system it talks to. The authoritative server-side security documentation lives in the backend: [cpccu-server/docs/SECURITY.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md).

> **Rule of thumb:** the backend is the security authority for authentication and authorization. The frontend never "enforces" security on its own — it reflects the backend's decisions.

---

## 1. Authentication & sessions (frontend view)

- **Access token** — the JWT returned by `POST /auth/login` is stored in `localStorage` (`token`), with the user object in `localStorage` (`user`). It is sent as `Authorization: Bearer <token>` on every RTK Query request (`src/services/baseApi.js`), with `credentials: 'include'` for cookie-based flows.
- **No refresh token on the client** — the refresh token lives only in the backend's `httpOnly` cookie. The frontend does not call `GET /auth/refresh-token`.
- **Session hydration** — `ProviderWrapper` (`src/app/redux/ProviderWrapper.js`) validates the stored token on app load via `GET /users/user`; on failure it clears `localStorage` and the Redux state.
- **Protected routes** — the admin panel is guarded client-side by `src/components/admin-layout.jsx` for roles `admin`/`moderator`/`mentor`. **This is UX, not security** — the backend enforces the same roles on every `/admin/*` API route.

## 2. Email-verification enforcement

The backend is the security authority:

- Unverified accounts (`isValid: false`) cannot log in — the backend returns **`403` + `EMAIL_NOT_VERIFIED`** and issues no session.
- `verifyToken` rejects unverified users even with a valid access token, and neither refresh path can renew an unverified session.
- The frontend (`Login.jsx`) detects `EMAIL_NOT_VERIFIED` and reopens the OTP popup; it never stores credentials for an unverified account.

See [ADR-015](./ADR.md#adr-015--backend-enforced-email-verification) and the backend [SECURITY.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md).

## 3. Transport & headers

- `src/proxy.ts` (Next.js 16 proxy) applies on every route (except `_next/static` and `_next/image`):
  - **CSP** (production only): `default-src 'self'`; scripts/styles allow inline; `img-src` allows `data: blob: https:`; `connect-src` allows the app origin, Google Fonts, Cloudinary, ui-avatars, and `https: ws:`; `frame-ancestors 'none'`; `form-action 'self'`; `upgrade-insecure-requests`.
  - **`frame-src` — `'self' https://drive.google.com https://docs.google.com`.** A fixed, two-host allow-list rather than `https:`. Without an explicit `frame-src`, the `default-src 'self'` above governs `<iframe>` targets, so a frame pointing at Google Drive is blocked in production while working under `next dev` — the whole CSP block is production-only, making that a silent prod-only breakage local testing cannot catch. And a blanket `frame-src https:` would let **any** admin-supplied URL be framed inside our own origin, which is a phishing / UI-redressing surface: a framed page inherits our address bar, our TLS indicator and our layout. See [ADR-017](./ADR.md#adr-017--fixed-frame-src-allowlist-coupled-to-the-embeddable-host-list).
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geolocation/USB/payment/sensors off), COOP/COEP/CORP, and **HSTS** (except on localhost).
- The backend adds its own helmet headers + HSTS (`NODE_ENV=production`).

> ⚠️ **`frame-src` and `EMBED_ALLOWED_HOSTS` in `src/lib/hackathon.js` are coupled by design and must not diverge.** The allow-list in `deriveEmbeddableUrl` decides *which* admin URLs may be framed; the CSP decides whether the frame actually loads. Add a host to one without the other and the rule book renders correctly under `next dev` and as a silently blank frame in production. `deriveEmbeddableUrl` also **rebuilds** every URL it returns on a bare, canonical host (never `www.`-prefixed) because CSP host matching is exact.
>
> `X-Frame-Options: DENY` / `frame-ancestors 'none'` are unrelated and must not be relaxed: they govern whether **our** pages may be framed by someone else, not what we may frame.

### 3.1 The backend CSRF guard and this client

The backend mounts a CSRF guard (`src/middlewares/csrfGuard.middleware.js`, `app.js:35`) on **every** request, after `cors()` and before body parsing: `Sec-Fetch-Site` is checked on every method (only `same-origin` / `same-site` / `none` pass), and `Origin` is checked on mutating methods plus the two state-changing GET prefixes (`/auth/logout`, `/auth/reset-link/`), against the same `ALLOWED_ORIGINS` list `cors()` uses (`src/utils/corsOrigins.js`, exact-match).

What this means for the frontend:

- **The client does nothing, and must invent nothing.** There is still **no CSRF token** anywhere in the system — the guard is header-based. RTK Query already sends `credentials: 'include'` and the `Authorization: Bearer` header; a legitimate call from this origin passes both checks by construction. Do not add a token field to requests — no backend middleware validates one.
- **The auth cookie is still `SameSite=None`**, forced by the topology (frontend on Vercel, API on Render — different origins, so `Lax` would drop the cookie on every authenticated call). That is exactly why the guard exists: a cross-site form or `fetch()` forged from a third-party page carries `Sec-Fetch-Site: cross-site` and is refused with a `403` before it reaches a handler.
- **The allow-list is load-bearing for this client.** The production origins (`cpccu.club`, `www.cpccu.club`, `cpccu.pro.bd`, `www.cpccu.pro.bd`, `cpccu-client.vercel.app`, `cpccu-client-nextjs.onrender.com`) are on the backend's list. Serving the frontend from a **new** origin without adding it to the backend's `ALLOWED_ORIGINS` (the `CORS_ORIGIN` env var or the list itself) breaks every mutating call with a `403` — and `cors()` would refuse it earlier anyway.
- **The client calls one of the two state-changing GETs** — `GET /auth/logout` (`authApi.logout`). It passes the guard because the request is same-site from the browser's perspective and carries an allowed `Origin`.
- **Residual gap, unchanged:** browsers older than **Chrome 76 / Firefox 90 / Safari 16.4** send neither header, so against those the guard is inert and the original cross-site exposure stands. The only remaining answer is a synchroniser token, which is not implemented. Full detail: backend [SECURITY.md §4.1](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md#41-csrf-guard-srcmiddlewarescsrfguardmiddlewarejs).

> ℹ️ This is the mitigation for the cross-site-form finding formerly recorded as HIGH in the backend's known-debt list. It is a header check, not a token — see the residual gap above before assuming the issue is closed.

## 4. Hackathon surface (frontend view)

The frontend **never** enforces the hackathon's access rules — the backend does, and the client only decides what to *offer*. Two things are worth stating precisely because they are easy to read backwards:

- **The problem set is server-gated twice.** `GET /content/hackathon/problem-set` requires `verifyToken` **and** a start-time check. The `problemSetAvailable` flag on the public payload, and the local `hasHackathonStarted()` mirror, are **advisory**: forging either in devtools earns a 403 and nothing else, because the endpoint re-checks server-side. The client's rule is a strict AND of the server flag and the local clock, and it `skip`s the request entirely until both are satisfied — so a signed-in visitor cannot even probe for a set that has not been released.
- **Every admin-supplied URL passes through `toSafeHref`** in `toPublicHackathon` and in `toPublicEvent`'s `btnLink` / `btnLink1`, and is re-validated on arrival in `HackathonProblemSet`. This is a *read-time* backstop independent of the server's write-time validation: documents written before the validator existed, or hand-edited in Mongo, would otherwise reach React as a live `javascript:` href. Blanking degrades the field to "no link", which is the correct outcome for a value that should never have been linkable. `img` is deliberately **not** sanitised — it renders as an `<img src>`, never an `href`, and `toSafeHref` would reject the legitimate root-relative upload paths.
- **`/hackathon` has no route guard, deliberately.** A bookmarked URL renders the page shell with an "unavailable" message when the toggle is off. Nothing on the page is protected — the one confidential artefact is fetched from a separate gated endpoint that the page never embeds. A client-side guard would be security theatre: it would hide an empty page while the actual gate stays on the endpoint.
- **Outbound links are plain anchors.** Every admin-supplied external link is `<a target="_blank" rel="noopener noreferrer">`, never `next/link` (which client-navigates, pulling an external href through our own router). Without `noopener` the opened page keeps a `window.opener` handle back into our site. This is manual discipline: `.eslintrc.cjs` sets `react/jsx-no-target-blank: "error"` but `npm run lint` cannot run at all. Internal routes such as `/login` correctly keep using `next/link`.

## 5. Known tradeoffs & debt (frontend)

### localStorage JWT (XSS tradeoff) — INFO

The access token is readable by any script running on the page, so a successful XSS could exfiltrate it. Mitigations in place: strict CSP, no untrusted-HTML rendering patterns, short-lived access tokens. The refresh token stays in an `httpOnly` cookie, limiting a leaked access token's usefulness to its lifetime.

### Dead client refresh endpoint — INFO

The backend exposes `GET /auth/refresh-token`, but this app never calls it. If you add client-side refresh handling, coordinate with the backend's persisted `refreshTokens[]` validation and keep the unverified-account rejection.

### No frontend tests — INFO

There are no automated frontend tests and **no test runner** in this repo — no framework, no config, no setup file, no `test` script. Do not claim frontend unit tests exist. **`npm run build` is the only automated verification** this repo has, and security-sensitive changes are additionally verified by the backend suite (`npm test` in `cpccu-server`), which does cover the CSRF guard, the participation routes and the member-authorisation matrix.

> ⚠️ `next build` is **not** a type-safety result. There is no `tsconfig.json` in this repo — `jsconfig.json` provides path aliases for editor resolution only — so the build performs no project-wide type check and its "Running TypeScript" step is a no-op. It is a module-resolution and render check. The pure helpers in `src/lib/countdown.js` were written without React, timers or hidden state specifically so they can be verified by inspection, which is the only option available here.

## 6. Do not

- Do not implement client-side-only verification gates — the backend enforces `isValid` **and** the hackathon's problem-set release.
- Do not add a host to `EMBED_ALLOWED_HOSTS` (or `deriveEmbeddableUrl`) without adding it to the CSP `frame-src` list, or the embed breaks in production only.
- Do not weaken the CSP `connect-src` or replace the fixed `frame-src` with `https:` without a reason; new external origins must be added there deliberately.
- Do not put an admin-supplied external href on `next/link`, and do not render an `<iframe src={adminSuppliedUrl}>` for a host `deriveEmbeddableUrl` returned `null` for — render the "open in a new tab" card.
- Do not move secrets into `NEXT_PUBLIC_*` — anything prefixed that way ships to the browser, and it is inlined at **build** time, so a set-but-wrong value silently wins in production.
- Do not log tokens, passwords, or OTPs on the client.

## 7. Related documents

- [Architecture — Auth (§6)](./ARCHITECTURE.md#6-authentication)
- [Architecture — Hackathon (§19)](./ARCHITECTURE.md#19-hackathon)
- [ADR-011 — Authentication architecture](./ADR.md#adr-011--authentication-architecture)
- [ADR-015 — Backend-enforced email verification](./ADR.md#adr-015--backend-enforced-email-verification)
- [ADR-016 — Hackathon reuses the Event model](./ADR.md#adr-016--hackathon-reuses-the-event-model-with-dedicated-public-routes)
- [ADR-017 — Fixed `frame-src` allowlist](./ADR.md#adr-017--fixed-frame-src-allowlist-coupled-to-the-embeddable-host-list)
- Backend [SECURITY.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md) — full backend controls, the URL policy (§6.1) and the problem-set gating design (§6.2).
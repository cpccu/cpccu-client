# Security

This document describes the **actual** security posture of the CPCCU application (`cpccu-client`), which serves both the frontend and the API.

> **The API is in this repository.** The route handlers under `src/app/api/**` are the system of record for authentication, authorization, input handling, uploads and rate limiting. The retired Express backend (`cpccu-server`, a separate repository) is a read-only historical reference; nothing here is enforced by it at runtime. [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) is the full record of the migration and its security review.

> **Rule of thumb:** the server is the security authority for authentication and authorization. The frontend never "enforces" security on its own — it reflects the server's decisions.

---

## 1. Authentication & sessions

- **The session is an `httpOnly` cookie.** `POST /api/v1/auth/login` and `GET /api/v1/auth/refresh-token` set `accessToken` / `refreshToken` as `httpOnly`, `SameSite=Lax`, `path: '/'` cookies and return **no token in the response body** — the login body is `{ user }` and the refresh body is `{ success: true }`.
- **The client holds no token.** No file under `src/` stores a session credential and `baseApi` attaches **no `Authorization` header**. This is deliberate: the previous model kept a third copy in `localStorage` and sent it as a bearer token, so a token readable by any XSS was the credential while the unreadable cookie was ignored. That trade-off is now gone rather than mitigated.
- **`localStorage` no longer holds a `user` object at all.** It *used to*, justified as "a cache, not a credential, so first paint can show the right nav without waiting for the round trip" — and a repo-wide search found **no reader**: the only `localStorage.getItem` calls under `src/` are a commented-out `"token"` read in `ProviderWrapper.js` and an unrelated `VISITOR_KEY` read in `VisitorCounter.jsx`. The write put `email`, `phone`, `uniID`, `roles` and both Cloudinary `*PublicId` primitives into a store any XSS on the origin can read, which is exactly the exposure the `httpOnly` move was made to eliminate. Removed 2026-09 from `setCredentials`; the hydrator reads from `GET /api/v1/users/user`, so nothing depended on it. `clearCredentials` still scrubs both the `user` and `token` keys, because that is the cheapest point at which to delete what earlier builds left behind — including a live seven-day access token in `token`. **Do not remove the scrub, and do not reinstate the write.**
- **`GET /api/v1/users/user` is the sole authority on session identity.** `ProviderWrapper` (`src/app/redux/ProviderWrapper.js`) calls it on every page load with **no `skip` gate** — the cookie is sent automatically, so there is nothing client-side to gate on — and dispatches `clearCredentials` on any error, including 5xx. A 401 here is what "not logged in" means to the whole application.
- **No refresh flow on the client.** `GET /api/v1/auth/refresh-token` exists server-side and the client never calls it; transparent renewal happens inside `src/lib/server/auth.js`, which re-issues the access-token cookie when it sees an expired one. There is no Google OAuth flow.
- **`POST /api/v1/auth/logout`** — not `GET`. It was `GET` until the cutover, and `GET` is exempt from the CSRF check, so a cross-site top-level `GET` (an `<img src>`, a redirect, a `<link rel=prefetch>`) could force-log a victim out *and* revoke their refresh token for the full seven days it is scoped to. `POST` brings the endpoint under `assertSameOrigin` for the first time. Do not add a `GET` fallback.
- **Logging out actually ends the session, even with an expired access token.** `verifyToken` performs a *transparent refresh*: an expired `accessToken` is exchanged for a fresh one as a side effect, on every authenticated route. `applyAuthCookie` then writes that cookie **after** the route handler has run, and `ResponseCookies.set()` **replaces** a same-name entry rather than appending. So a logout that queued `clearCookie('accessToken')` used to have its deletion silently ERASED: the refresh token was revoked, but the browser kept a live, correctly-signed 15-minute `accessToken`, and `GET /api/v1/users/user` answered 200 with the departed user's `email`, `phone`, `uniID` and `roles` for its remaining lifetime — the ordinary case being a tab left open past 15 minutes, then logged out on a shared machine. The shim now reports the cookie **names** the controller deleted (`collect.clearedCookieNames`), `runController` carries them, and `apiRoute` withholds any `refreshCookie` of one of those names (`suppressClearedRefreshCookie`). **The precedence for every other case is unchanged and must not be reversed:** a controller that merely *sets* a cookie is still outranked by the auth layer, because `verifyToken` validated the token against live session state moments earlier. `test/cookie-output.test.js` asserts both halves.
- **`POST /api/v1/auth/reset-link`**, not `GET`, and the address is in the **body**. It was `GET /api/v1/auth/reset-link/:email` until the cutover, and that combination was exploitable without any credential: `GET` is exempt from `assertSameOrigin`, and a target address in the **path** means a bare cross-site `<img src>` or top-level navigation is sufficient — no XHR, no CORS, no form. Every hit sent a genuine CPCCU-branded password-reset email to an attacker-chosen address, which is a mail-bomb and Resend sender-quota-burn primitive and a phishing lure aimed at anyone. A `POST` body cannot be produced that way, so the CSRF check is armed and refuses the request before any mail is sent. `authEmailRateLimiter` is **not** the control — its store is per-instance, so on Vercel it is close to unenforced. **The response must stay byte-identical for "no such account" and "sent"**; that is what keeps the endpoint from becoming an account-existence oracle, and `test/auth-reset-link.test.js` asserts it on both paths. Do not return a 404, and do not add a `GET` fallback — a `GET` could only read the address from the path, which is the exploitable half of the old design.
- **Protected routes** — the admin panel is guarded client-side by `src/components/admin-layout.jsx` for roles `admin`/`moderator`/`mentor`. **This is UX, not security** — the server enforces the same roles on every `/admin/*` API route, auth-by-default (a route is authenticated unless it declares `public: true`).

### 1.1 CSRF

- `SameSite=Lax` closes the cross-site cookie path, and `assertSameOrigin` (`src/lib/server/request.js`) is an independent second layer on every unsafe method.
- `Sec-Fetch-Site` is the primary signal — a browser sets it, no script can forge it. `same-site` is accepted **only** in combination with an allow-listed `Origin`, because a sibling subdomain, a compromised subdomain and `cpccu.club.attacker.net`'s cookie scope all satisfy `same-site` by themselves.
- The allow-list is seeded from **`WEB_DOMAIN`** and **`NEXT_PUBLIC_SITE_URL`** (the apex/`www.` siblings are derived), with `EXTRA_ALLOWED_ORIGINS` as an additive, deployment-time escape hatch. **A wrong value here 403s every unsafe method while reads keep working.** It is the most consequential environment variable in the application, and `test/csrf.test.js` covers the decision table.
- Non-browser callers (curl, CLI, integration tests) that present neither `Sec-Fetch-Site` nor `Origin` are admitted **only** with an `Authorization: Bearer` header — a non-simple header that a cross-site page cannot set without a preflight this API never answers, so such a request is structurally not CSRF-able. The first-party web client never uses this exemption.

## 2. Email-verification enforcement

The server is the security authority:

- Unverified accounts (`isValid: false`) cannot log in — the server returns **`403` + `EMAIL_NOT_VERIFIED`** and issues no session and no cookies.
- `verifyToken` rejects unverified users even with a valid access token, and neither refresh path can renew an unverified session.
- The frontend (`Login.jsx`) detects `EMAIL_NOT_VERIFIED` and reopens the OTP popup; it never stores credentials for an unverified account.

See [ADR-015](./ADR.md#adr-015--backend-enforced-email-verification) and [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §5.12 (the narrowed `PUBLIC_MEMBER_ITEM` projection) and §5.13 (the contact endpoint's field-pick).

## 3. Transport & headers

- `src/proxy.ts` (Next.js 16 proxy) applies on every route (except `_next/static` and `_next/image`):
  - **CSP** (production only): `default-src 'self'`; scripts/styles allow inline; `img-src` allows `data: blob: https:`; `connect-src` allows the app origin, Google Fonts, Cloudinary, ui-avatars, and `https: ws:`; `frame-ancestors 'none'`; `form-action 'self'`; `upgrade-insecure-requests`.
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geolocation/USB/payment/sensors off), COOP/COEP/CORP, and **HSTS** (except on localhost).
- API responses get `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` from the route-handler wrapper (`src/lib/server/http.js`), which is the **only** source of `nosniff` on an API response and is a backstop for the CSP, not a duplicate of it. `no-store` is set unconditionally, overwriting anything a handler set: these are per-user payloads, and it also stops a 401 being replayed after a successful login.
- **Transport is same-origin.** There is no cross-origin API hop, so CORS is not a control in this system and there is nothing to configure at the far end.
- **Hosting constraint:** every IP-keyed rate limiter trusts headers the Vercel edge overwrites. On any other host those headers are client-supplied and every one of those limiters is forgeable with a single request. See [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8.2.

## 4. Known tradeoffs & debt

### The localStorage JWT XSS tradeoff — RESOLVED (was INFO)

This used to be an accepted risk: the access token sat in `localStorage`, readable by any script on the page, so a successful XSS could exfiltrate it. The cutover removed the token from the response body and from the client entirely; the `httpOnly` cookie is the only credential, and a token that script cannot read cannot be stolen by XSS. The residual risk is the same one every cookie session has — an XSS can still *act* as the user for as long as the session lasts, so the CSP, the absence of untrusted-HTML rendering patterns, and the short access-token lifetime still matter. See §1.

### Error-detail redaction is gated on `VERBOSE_ERRORS`, not on `NODE_ENV` — RESOLVED (was MEDIUM)

`verifyToken`'s non-expiry JWT branch returns raw `jsonwebtoken` text (`"jwt malformed"`, `"invalid signature"`), which is a forgery oracle: the difference between those two tells an attacker probing token forgery whether the token they submitted was structurally well-formed. It used to be redacted only when `NODE_ENV === 'production'`. **`NODE_ENV` is not under the application's control** — it is set by the build and by the platform — so a real host built with it unset, or to `development`, or to a staging value, serves a production database while taking the non-redacting branch. The failure is invisible: the only symptom is that some 401 bodies get more interesting. `errors.js` already had `VERBOSE_ERRORS` for exactly this reason, but the fix was never applied to `auth.js`, so the two redactions disagreed. Both now call the shared `resolveVerboseErrors()` (`src/lib/server/errors.js`), which lets `VERBOSE_ERRORS` override `NODE_ENV` **in both directions** via an explicit `'true'`/`'false'` string equality (not truthiness, so `VERBOSE_ERRORS=0` does not enable the dangerous branch). The real error is always logged regardless. `test/error-redaction.test.js` covers all four combinations end-to-end. **Residual, accepted:** the timing channel on `reset-link` is not addressed — see §1.

### Dead client refresh endpoint — INFO

`GET /api/v1/auth/refresh-token` exists server-side and this app never calls it; renewal is transparent and server-side. If you add client-side refresh handling, coordinate with the persisted `refreshTokens[]` validation and keep the unverified-account rejection.

### Rate limiting is not effectively enforced — HIGH (open)

The default rate-limit store is an in-process `Map`, which is not shared across Vercel instances, so `loginRateLimiter` (10 / 15 min) and `contactRateLimiter` (3 / min) are the **only** brute-force and spam controls on their routes and they are effectively **unenforced** — with no exception, no error and no log line. `setRateLimitStore` is written, validated and unwired; the owner's decision was to defer a Redis/KV dependency, with a Vercel Firewall rate-limit rule as the recommended alternative. Full analysis, blast radius and the controls that remain unenforced are in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8. **Alert on the limiter's `console.error`.**

### Preserved defects carried over from the Express original

Fifteen documented defects were ported on purpose — mass assignment on admin content, a writable audit trail, `Boolean("false") === true` on role updates, refresh tokens surviving a password reset, and so on. They are *not* migration regressions, but they are now in this repository and are therefore ours. The full table is in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §6.

### Verification — `npm test` / `npm run lint`

`npm test` runs a `node --test` suite (no framework dependency) covering the admin role matrix, the four `toErrorResponse` branches, `getClientIp`, `assertSameOrigin`, `clientIp` fall-through, anonymous projections, the route-method declaration, and **client/server endpoint parity**. `npm run lint` runs ESLint over the repo. Neither is optional for a change that touches auth, the admin role matrix, or an endpoint on either side of the wire. What the suite still leaves uncovered is recorded in [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §11.

## 5. Do not

- Do not implement client-side-only verification gates — the server enforces `isValid`.
- Do not re-introduce a client-side token store, or an `Authorization` header in `baseApi`. If you find yourself wanting one, the answer is a server-side change, not a client one.
- Do not use `state.auth.user` (or the `localStorage` copy) to decide whether someone is logged in. Ask `GET /api/v1/users/user`.
- Do not add a `GET` variant of `POST /api/v1/auth/logout`.
- Do not weaken the CSP `connect-src` without a reason; new external origins must be added there deliberately.
- Do not widen `images.remotePatterns` back to a wildcard, or add a new host without checking where that URL is stored and who can set it.
- Do not move secrets into `NEXT_PUBLIC_*` — anything prefixed that way ships to the browser and is inlined at build time.
- Do not log tokens, passwords, or OTPs on the client.

## 6. Related documents

- [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) — the migration, the security review outcome (§7), the rate-limiting risk (§8), and the preserved defects (§6).
- [Architecture — Auth (§6)](./ARCHITECTURE.md#6-authentication)
- [ADR-011 — Authentication architecture](./ADR.md#adr-011--authentication-architecture)
- [ADR-015 — Backend-enforced email verification](./ADR.md#adr-015--backend-enforced-email-verification)
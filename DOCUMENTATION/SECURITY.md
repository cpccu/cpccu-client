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
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geolocation/USB/payment/sensors off), COOP/COEP/CORP, and **HSTS** (except on localhost).
- The backend adds its own helmet headers + HSTS (`NODE_ENV=production`).

## 4. Known tradeoffs & debt (frontend)

### localStorage JWT (XSS tradeoff) — INFO

The access token is readable by any script running on the page, so a successful XSS could exfiltrate it. Mitigations in place: strict CSP, no untrusted-HTML rendering patterns, short-lived access tokens. The refresh token stays in an `httpOnly` cookie, limiting a leaked access token's usefulness to its lifetime.

### Dead client refresh endpoint — INFO

The backend exposes `GET /auth/refresh-token`, but this app never calls it. If you add client-side refresh handling, coordinate with the backend's persisted `refreshTokens[]` validation and keep the unverified-account rejection.

### No frontend tests — INFO

There are no automated frontend tests; security-sensitive changes are verified with `npm run build` (frontend lint is currently broken — see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#10-build--lint-failures)) and the backend's auth regression suite (`npm test` in `cpccu-server`).

## 5. Do not

- Do not implement client-side-only verification gates — the backend enforces `isValid`.
- Do not weaken the CSP `connect-src` without a reason; new external origins must be added there deliberately.
- Do not move secrets into `NEXT_PUBLIC_*` — anything prefixed that way ships to the browser.
- Do not log tokens, passwords, or OTPs on the client.

## 6. Related documents

- [Architecture — Auth (§6)](./ARCHITECTURE.md#6-authentication)
- [ADR-011 — Authentication architecture](./ADR.md#adr-011--authentication-architecture)
- [ADR-015 — Backend-enforced email verification](./ADR.md#adr-015--backend-enforced-email-verification)
- Backend [SECURITY.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md) — full backend controls + known security debt (including the unthrottled `verify-registration` endpoint).